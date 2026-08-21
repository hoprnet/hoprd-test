#!/usr/bin/env bash
# Resolve versions, build hoprd + hoprd-localcluster + the blokli binary chain,
# link edgli, and run the integration throughput test against a fresh flake-built
# chain per scenario (no docker image).
#
# Version model — no stored state, no commits:
#   * the triggering project (PROJECT) uses the rev from the dispatch;
#   * hoprd/edge-client otherwise default to their main HEAD;
#   * blokli is ALWAYS the latest GitHub release (resolved per run), built from
#     its flake — no floating docker tag, no unreleased-merge testing.
# So a hoprd/edge-client merge is tested against the current tip of the other and
# the latest blokli release.
#
# Inputs (env):
#   PROJECT          hoprd | edge-client | "" (manual = all defaults)
#   OVERRIDE_REV     git rev for PROJECT when it is hoprd or edge-client
#   HOPRD_REF        default hoprd ref       (default: main)
#   EDGLI_REF        default edge-client ref (default: main)
#   BLOKLI_REF       blokli release override (default: latest release tag)
#   NIX_SYSTEM_SUFFIX    nix output arch suffix (default: x86_64-linux)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CRATE_CARGO="${REPO_ROOT}/integration/Cargo.toml"
ARCH="${NIX_SYSTEM_SUFFIX:-x86_64-linux}"

HOPRD_REF="${HOPRD_REF:-main}"
EDGLI_REF="${EDGLI_REF:-main}"

# The triggering project overrides its own rev; the other defaults to main.
case "${PROJECT:-}" in
hoprd) HOPRD_REF="${OVERRIDE_REV:?OVERRIDE_REV required for PROJECT=hoprd}" ;;
edge-client) EDGLI_REF="${OVERRIDE_REV:?OVERRIDE_REV required for PROJECT=edge-client}" ;;
blokli) echo "PROJECT=blokli: merge-testing dropped — running hoprd/edge-client main against latest blokli release" ;;
"" | manual) echo "no PROJECT override — hoprd/edge-client at main, blokli at latest release" ;;
*)
  echo "unknown PROJECT '${PROJECT}'" >&2
  exit 2
  ;;
esac

# Resolve edge-client ref → concrete sha (cargo git `rev` needs a commit, not a branch).
resolve_sha() { # owner/repo ref
  local ref="$2"
  if [[ $ref =~ ^[0-9a-f]{7,40}$ ]]; then
    echo "$ref"
    return
  fi
  # Resolve via `gh api`, not `git ls-remote`: the dev shell's LD_LIBRARY_PATH points
  # at nix glibc, which the system `git-remote-https` helper loads over its older
  # system glibc, tripping `GLIBC_ABI_DT_X86_64_PLT not found` and aborting the fetch
  # on CI. `gh` is a self-contained nix binary on PATH (auth via GH_TOKEN in CI; the
  # repo is public, so this also works unauthenticated locally).
  gh api "repos/$1/commits/${ref}" --jq '.sha' 2>/dev/null
}
EDGLI_SHA="$(resolve_sha hoprnet/edge-client "${EDGLI_REF}")"
[ -n "${EDGLI_SHA}" ] || {
  echo "could not resolve edge-client ref '${EDGLI_REF}'" >&2
  exit 1
}

# Resolve blokli → latest release tag (override with BLOKLI_REF). Same `gh api`
# rationale as edgli above: self-contained nix binary, dodges the glibc trip.
BLOKLI_REF="${BLOKLI_REF:-$(gh api repos/hoprnet/blokli/releases/latest --jq '.tag_name' 2>/dev/null)}"
[ -n "${BLOKLI_REF}" ] || {
  echo "could not resolve latest blokli release" >&2
  exit 1
}

echo "resolved versions:"
echo "  hoprd        = ${HOPRD_REF}"
echo "  edge-client  = ${EDGLI_REF} (${EDGLI_SHA})"
echo "  blokli       = ${BLOKLI_REF} (latest release)"

# ── Build hoprd + hoprd-localcluster from the hoprd ref (Cachix-cached) ──
echo "building hoprd binaries from ref ${HOPRD_REF} ..."
nix build -L "github:hoprnet/hoprd/${HOPRD_REF}#binary-hoprd-${ARCH}" --out-link "${REPO_ROOT}/result-hoprd"
nix build -L "github:hoprnet/hoprd/${HOPRD_REF}#binary-hoprd-localcluster-${ARCH}" --out-link "${REPO_ROOT}/result-localcluster"

# ── Build the blokli binary chain from the release (bloklid + deployer + anvil) ──
echo "building blokli chain from release ${BLOKLI_REF} ..."
nix build -L "github:hoprnet/blokli/${BLOKLI_REF}#bloklid" --out-link "${REPO_ROOT}/result-bloklid"
nix build -L "nixpkgs#foundry" --out-link "${REPO_ROOT}/result-foundry"

# ── Pin edgli to the resolved sha and refresh the lockfile ──
echo "pinning edgli to ${EDGLI_SHA} ..."
python3 - "$CRATE_CARGO" "$EDGLI_SHA" <<'PY'
import re, sys
path, rev = sys.argv[1], sys.argv[2]
src = open(path).read()
# Replaces whichever ref the manifest carries with `rev = "<sha>"`. Both forms have to be handled:
# CI always pins a concrete sha, for reproducibility and because a dispatch supplies one, but the
# committed manifest tracks a branch so the default does not drift behind what CI tests. Matching
# only `rev` meant this exited on every run once the manifest moved to `branch`.
new, n = re.subn(r'(edgli\s*=\s*\{[^}]*?\b)(?:rev|branch)(\s*=\s*")[^"]*(")',
                 rf'\g<1>rev\g<2>{rev}\g<3>', src, count=1)
if n == 0:
    sys.exit(f"run.sh: no edgli rev/branch entry matched in {path} — the dependency "
             "stanza changed shape; refusing to run against a stale pin")
open(path, 'w').write(new)
PY
(cd "${REPO_ROOT}/integration" && cargo update -p edgli)

# ── Run the test against a fresh flake-built chain per scenario ──
# run-binchain.sh starts/stops bloklid+anvil per scenario (HOPRD_CHAIN_URL) and
# runs both hop counts (zero_hop, one_hop) as separate tests.
echo "running integration tests (binary chain) ..."
exec bash "$(dirname "${BASH_SOURCE[0]}")/run-binchain.sh"

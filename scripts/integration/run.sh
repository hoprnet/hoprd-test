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

# ── Pin edgli to the resolved sha, and hopr-lib to whatever that edgli pins ──
echo "pinning edgli to ${EDGLI_SHA} ..."
# Read through `gh api` for the reason resolve_sha gives: git-over-https is unusable in the dev
# shell. Needed because our `hopr-lib` must name the rev edgli resolves, and only edge-client's
# own manifest says which that is.
EDGLI_MANIFEST="$(gh api "repos/hoprnet/edge-client/contents/Cargo.toml?ref=${EDGLI_SHA}" \
  --jq '.content' 2>/dev/null | base64 -d)" || true
[ -n "${EDGLI_MANIFEST}" ] || {
  echo "could not read edge-client's Cargo.toml at ${EDGLI_SHA}" >&2
  exit 1
}
export EDGLI_MANIFEST
python3 - "$CRATE_CARGO" "$EDGLI_SHA" <<'PY'
import os, re, sys
path, rev = sys.argv[1], sys.argv[2]
src = open(path).read()
# Replaces whichever ref the manifest carries with `rev = "<sha>"`. Both forms have to be handled:
# CI always pins a concrete sha, for reproducibility and because a dispatch supplies one, but the
# committed manifest tracks a branch so the default does not drift behind what CI tests. Matching
# only `rev` meant this exited on every run once the manifest moved to `branch`.
src, n = re.subn(r'(edgli\s*=\s*\{[^}]*?\b)(?:rev|branch)(\s*=\s*")[^"]*(")',
                 rf'\g<1>rev\g<2>{rev}\g<3>', src, count=1)
if n == 0:
    sys.exit(f"run.sh: no edgli rev/branch entry matched in {path} — the dependency "
             "stanza changed shape; refusing to run against a stale pin")

# `hopr-lib` has to name the rev edgli itself resolves. Pinning only edgli leaves the two free to
# disagree, and cargo then locks *two* hopr-libs — and with them two `hopr-strategy`s, whose
# counters are registered in the same process and incremented by nobody. `tests/pix.rs` reads that
# as a full set of zeroes and concludes the entry never deposited, so a skew here is worse than a
# hard stop. edgli is authoritative (see the manifest's own hopr-lib comment), so follow its pin
# rather than demand the committed one already match: a dispatch that moved edge-client onto a new
# hoprnet rev should still run.
upstream = re.search(r'^hopr-lib\s*=\s*\{[^}]*?\brev\s*=\s*"([0-9a-f]{7,40})"',
                     os.environ['EDGLI_MANIFEST'], re.M | re.S)
if not upstream:
    sys.exit(f"run.sh: edge-client at {rev} pins hopr-lib by something other than a git rev — "
             f"align {path} by hand; see its hopr-lib comment")
hopr_lib_rev = upstream.group(1)
src, n = re.subn(r'(hopr-lib\s*=\s*\{[^}]*?\b)(?:rev|branch)(\s*=\s*")[^"]*(")',
                 rf'\g<1>rev\g<2>{hopr_lib_rev}\g<3>', src, count=1)
if n == 0:
    sys.exit(f"run.sh: no hopr-lib rev/branch entry matched in {path} — refusing to run with it "
             "possibly off edgli's hoprnet rev")

open(path, 'w').write(src)
print(f"  edgli    -> {rev}")
print(f"  hopr-lib -> {hopr_lib_rev} (edge-client's own pin)")
PY
(cd "${REPO_ROOT}/integration" && cargo update -p edgli -p hopr-lib)

# ── Run the test against a fresh flake-built chain per scenario ──
# run-binchain.sh starts/stops bloklid+anvil per scenario (HOPRD_CHAIN_URL) and
# runs both hop counts (zero_hop, one_hop) as separate tests.
echo "running integration tests (binary chain) ..."
exec bash "$(dirname "${BASH_SOURCE[0]}")/run-binchain.sh"

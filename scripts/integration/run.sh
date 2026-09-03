#!/usr/bin/env bash
# Resolve versions, build hoprd + hoprd-localcluster + the blokli binary chain,
# link edgli, and run the integration throughput test against a fresh flake-built
# chain per scenario (no docker image).
#
# Version model — no stored state, no commits:
#   * the triggering project (PROJECT) uses the rev from the dispatch;
#   * hoprd defaults to the v4 release line (see below), edge-client to main HEAD;
#   * blokli is ALWAYS the head of its `release/0.13` branch (the Jura/v4 line),
#     built from its flake — no docker image, no unreleased-merge testing.
# So a hoprd/edge-client merge is tested against the current tip of the other and
# the current Jura blokli.
#
# Branch model — hoprd is split into v4 and v5. hoprd `main` is v5; this test
# targets v4, because the integration crate pins hoprnet `release/4.0` (hopr-lib)
# and edge-client `main` resolves the same hopr-lib. Building hoprd from `main`
# would run a v5 binary against a v4 library set, which is not a supported
# combination. So HOPRD_LINE below is the branch the hoprd binaries come from, and
# any dispatched hoprd rev is required to be contained in it.
#
# Inputs (env):
#   PROJECT          hoprd | edge-client | "" (manual = all defaults)
#   OVERRIDE_REV     git rev for PROJECT when it is hoprd or edge-client
#   HOPRD_LINE       hoprd release line the rev must belong to (default: release/4.1)
#   HOPRD_REF        default hoprd ref       (default: ${HOPRD_LINE})
#   EDGLI_REF        default edge-client ref (default: main)
#   BLOKLI_REF       blokli ref override     (default: release/0.13, a moving branch)
#   HOPRD_SKIP_LINE_CHECK  set to 1 to run a hoprd rev outside HOPRD_LINE anyway
#   NIX_SYSTEM_SUFFIX    nix output arch suffix (default: x86_64-linux)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CRATE_CARGO="${REPO_ROOT}/integration/Cargo.toml"
ARCH="${NIX_SYSTEM_SUFFIX:-x86_64-linux}"

HOPRD_LINE="${HOPRD_LINE:-release/4.1}"
HOPRD_REF="${HOPRD_REF:-${HOPRD_LINE}}"
EDGLI_REF="${EDGLI_REF:-main}"

# The triggering project overrides its own rev; the other keeps its default above.
case "${PROJECT:-}" in
hoprd) HOPRD_REF="${OVERRIDE_REV:?OVERRIDE_REV required for PROJECT=hoprd}" ;;
edge-client) EDGLI_REF="${OVERRIDE_REV:?OVERRIDE_REV required for PROJECT=edge-client}" ;;
blokli) echo "PROJECT=blokli: merge-testing dropped — running hoprd ${HOPRD_LINE} / edge-client main against blokli ${BLOKLI_REF:-release/0.13}" ;;
"" | manual) echo "no PROJECT override — hoprd at ${HOPRD_LINE}, edge-client at main, blokli at ${BLOKLI_REF:-release/0.13}" ;;
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

# blokli tracks the `release/0.13` BRANCH — the line the Jura (v4) network runs,
# agreed with the blokli team. Deliberately a moving branch and not a resolved
# release number, so patch releases land without an edit here; `--refresh` on its
# build below is what makes that actually take effect.
#
# Note there is no `latest-jura` (or any `latest-*`) git tag in blokli — those
# names only ever existed as bloklid-anvil DOCKER tags, and this builds a flake
# ref, which resolves against git. Note also that the branch can sit ahead of what
# Jura actually deploys (branch head was 0.13.2 while jura-dev/prod pinned 0.13.1
# on 2026-09-03), so a green gate here is evidence about the 0.13 line, not proof
# about the exact deployed build.
BLOKLI_REF="${BLOKLI_REF:-release/0.13}"

# Reject a hoprd rev from the wrong side of the v4/v5 split. A merge dispatch from
# hoprd `main` carries a v5 sha, which pairs with a v4 hopr-lib only by accident;
# fail fast with the reason rather than after a 40-minute build + a red gate.
# `compare/<line>...<rev>` reports "identical"/"behind" when <rev> is contained in
# <line>, and "ahead"/"diverged" when it is not.
if [ "${HOPRD_SKIP_LINE_CHECK:-0}" != "1" ] && [ "${HOPRD_REF}" != "${HOPRD_LINE}" ]; then
  status="$(gh api "repos/hoprnet/hoprd/compare/${HOPRD_LINE}...${HOPRD_REF}" --jq '.status' 2>/dev/null || true)"
  case "${status}" in
  identical | behind) ;;
  "")
    echo "could not compare hoprd ref '${HOPRD_REF}' against '${HOPRD_LINE}'" >&2
    exit 1
    ;;
  *)
    echo "hoprd ref '${HOPRD_REF}' is not contained in '${HOPRD_LINE}' (compare: ${status})." >&2
    echo "This test targets the hoprd v4 line — the integration crate pins hoprnet release/4.0." >&2
    echo "Set HOPRD_LINE to the intended line, or HOPRD_SKIP_LINE_CHECK=1 to run anyway." >&2
    exit 1
    ;;
  esac
fi

echo "resolved versions:"
echo "  hoprd        = ${HOPRD_REF} (line ${HOPRD_LINE})"
echo "  edge-client  = ${EDGLI_REF} (${EDGLI_SHA})"
echo "  blokli       = ${BLOKLI_REF} (Jura/v4 line, moving branch)"

# ── Build hoprd + hoprd-localcluster from the hoprd ref (Cachix-cached) ──
echo "building hoprd binaries from ref ${HOPRD_REF} ..."
nix build -L "github:hoprnet/hoprd/${HOPRD_REF}#binary-hoprd-${ARCH}" --out-link "${REPO_ROOT}/result-hoprd"
nix build -L "github:hoprnet/hoprd/${HOPRD_REF}#binary-hoprd-localcluster-${ARCH}" --out-link "${REPO_ROOT}/result-localcluster"

# ── Build the blokli binary chain from the branch (bloklid + deployer + anvil) ──
# `--refresh` is load-bearing: nix caches a flake ref's resolved revision for
# `tarball-ttl` (1h by default), so without it a branch that moved inside that
# window silently rebuilds the previous revision — which defeats the point of
# tracking a moving ref at all.
echo "building blokli chain from ${BLOKLI_REF} ..."
nix build -L --refresh "github:hoprnet/blokli/${BLOKLI_REF}#bloklid" --out-link "${REPO_ROOT}/result-bloklid"
nix build -L "nixpkgs#foundry" --out-link "${REPO_ROOT}/result-foundry"

# ── Pin edgli to the resolved sha and refresh the lockfile ──
echo "pinning edgli to ${EDGLI_SHA} ..."
python3 - "$CRATE_CARGO" "$EDGLI_SHA" <<'PY'
import re, sys

path, rev = sys.argv[1], sys.argv[2]
src = open(path).read()

# The committed manifest pins edgli by BRANCH (`branch = "main"`) on purpose, so the
# default does not drift behind what CI tests. Pinning here therefore has to *replace
# the branch key with a rev*, not edit an existing rev — an earlier version of this
# only handled `rev = "<sha>"` and so could never match the committed state.
# Accept whichever key the stanza carries so a repeat run over an already-pinned
# manifest works too.
stanza = re.search(r'^edgli\s*=\s*\{.*?\}', src, re.S | re.M)
if not stanza:
    sys.exit(f"run.sh: no `edgli = {{ ... }}` dependency stanza in {path} — "
             "refusing to run against a stale pin")

pinned, n = re.subn(r'\b(?:branch|rev|tag)\s*=\s*"[^"]*"', f'rev = "{rev}"',
                    stanza.group(0), count=1)
if n == 0:
    sys.exit(f"run.sh: the edgli stanza in {path} carries no branch/rev/tag to "
             "pin — refusing to run against a stale pin")

open(path, 'w').write(src[: stanza.start()] + pinned + src[stanza.end() :])
print(f"  edgli pinned: {pinned.splitlines()[0]}")
PY
(cd "${REPO_ROOT}/integration" && cargo update -p edgli)

# ── Run the test against a fresh flake-built chain per scenario ──
# run-binchain.sh starts/stops bloklid+anvil per scenario (HOPRD_CHAIN_URL) and
# runs both hop counts (zero_hop, one_hop) as separate tests.
echo "running integration tests (binary chain) ..."
exec bash "$(dirname "${BASH_SOURCE[0]}")/run-binchain.sh"

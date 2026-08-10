#!/usr/bin/env bash
# Resolve versions, build hoprd + hoprd-localcluster, link edgli, pull the chain
# image, and run the integration throughput test.
#
# Version model — no stored state, no commits:
#   * the triggering project (PROJECT) uses the rev/image from the dispatch;
#   * the other two default to their main HEAD / :latest image.
# So a merge to any project is tested against the current tip of the other two.
#
# Inputs (env):
#   PROJECT          hoprd | edge-client | blokli | "" (manual = all defaults)
#   OVERRIDE_REV     git rev for PROJECT when it is hoprd or edge-client
#   OVERRIDE_IMAGE   image ref for PROJECT when it is blokli
#   HOPRD_REF        default hoprd ref      (default: main)
#   EDGLI_REF        default edge-client ref (default: main)
#   BLOKLID_ANVIL_IMAGE  default chain image (default: …/bloklid-anvil:latest-rhine)
#   NIX_SYSTEM_SUFFIX    nix output arch suffix (default: x86_64-linux)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CRATE_CARGO="${REPO_ROOT}/integration/Cargo.toml"
ARCH="${NIX_SYSTEM_SUFFIX:-x86_64-linux}"

HOPRD_REF="${HOPRD_REF:-main}"
EDGLI_REF="${EDGLI_REF:-main}"
CHAIN_IMAGE="${BLOKLID_ANVIL_IMAGE:-europe-west3-docker.pkg.dev/hoprassociation/docker-images/bloklid-anvil:latest-rhine}"

# The triggering project overrides its own ref/image; others keep the defaults.
case "${PROJECT:-}" in
hoprd) HOPRD_REF="${OVERRIDE_REV:?OVERRIDE_REV required for PROJECT=hoprd}" ;;
edge-client) EDGLI_REF="${OVERRIDE_REV:?OVERRIDE_REV required for PROJECT=edge-client}" ;;
blokli) CHAIN_IMAGE="${OVERRIDE_IMAGE:?OVERRIDE_IMAGE required for PROJECT=blokli}" ;;
"" | manual) echo "no PROJECT override — all three at default (main / latest)" ;;
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
  # on CI. `gh` is a self-contained nix binary already on PATH and authenticated via
  # the dev shell's GITHUB_TOKEN, and it handles the private edge-client repo.
  gh api "repos/$1/commits/${ref}" --jq '.sha' 2>/dev/null
}
EDGLI_SHA="$(resolve_sha hoprnet/edge-client "${EDGLI_REF}")"
[ -n "${EDGLI_SHA}" ] || {
  echo "could not resolve edge-client ref '${EDGLI_REF}'" >&2
  exit 1
}

echo "resolved versions:"
echo "  hoprd        = ${HOPRD_REF}"
echo "  edge-client  = ${EDGLI_REF} (${EDGLI_SHA})"
echo "  bloklid-anvil= ${CHAIN_IMAGE}"

# ── Preflight: docker daemon up, nix present, chain image pulled ──
bash "$(dirname "${BASH_SOURCE[0]}")/preflight.sh" "${CHAIN_IMAGE}"

# ── Build hoprd + hoprd-localcluster from the hoprd ref (Cachix-cached) ──
echo "building hoprd binaries from ref ${HOPRD_REF} ..."
nix build -L "github:hoprnet/hoprd/${HOPRD_REF}#binary-hoprd-${ARCH}" --out-link "${REPO_ROOT}/result-hoprd"
nix build -L "github:hoprnet/hoprd/${HOPRD_REF}#binary-hoprd-localcluster-${ARCH}" --out-link "${REPO_ROOT}/result-localcluster"

# ── Pin edgli to the resolved sha and refresh the lockfile ──
echo "pinning edgli to ${EDGLI_SHA} ..."
python3 - "$CRATE_CARGO" "$EDGLI_SHA" <<'PY'
import re, sys
path, rev = sys.argv[1], sys.argv[2]
src = open(path).read()
new, n = re.subn(r'(edgli\s*=\s*\{[^}]*?\brev\s*=\s*")[0-9a-f]{7,40}(")',
                 rf'\g<1>{rev}\g<2>', src, count=1)
if n == 0:
    sys.exit(f"run.sh: no edgli rev entry matched in {path} — the dependency "
             "stanza changed shape; refusing to run against a stale pin")
open(path, 'w').write(new)
PY
(cd "${REPO_ROOT}/integration" && cargo update -p edgli)

# ── Run the test ──
export HOPRD_BIN="${REPO_ROOT}/result-hoprd/bin/hoprd"
export HOPRD_LOCALCLUSTER_BIN="${REPO_ROOT}/result-localcluster/bin/hoprd-localcluster"
export HOPRD_CHAIN_IMAGE="${CHAIN_IMAGE}"
# Debug-build async setup overflows the default thread stack on x86_64 CI.
export RUST_MIN_STACK="${RUST_MIN_STACK:-33554432}"
# Cap send rate so the CPU-constrained runner's packet pool doesn't saturate.
export HOPRD_PUMP_MBPS="${HOPRD_PUMP_MBPS:-0.5}"
echo "running integration tests ..."
# Only the integration tests (the `integration` test target) — not the crate's
# unit tests. Both hop counts (zero_hop, one_hop) run as separate tests.
(cd "${REPO_ROOT}/integration" && cargo test --test integration --no-fail-fast -- --include-ignored --test-threads=1)

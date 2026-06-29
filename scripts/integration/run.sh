#!/usr/bin/env bash
# Resolve pinned versions, build hoprd + hoprd-localcluster from a git rev, pull
# the bloklid-anvil chain image, link edgli at its rev, and run the integration
# throughput test.
#
# Inputs (env):
#   PROJECT                 one of: hoprd | edge-client | blokli  (the triggering repo; optional for manual runs)
#   OVERRIDE_REV            git rev to use for PROJECT when it is hoprd or edge-client
#   OVERRIDE_IMAGE          image ref to use for PROJECT when it is blokli
#   NIX_SYSTEM_SUFFIX       nix output arch suffix (default: x86_64-linux)
#   plus any HOPRD_E2E_* gating knobs, forwarded to the test as-is.
#
# Outputs: writes the resolved pins to $RESOLVED_OUT (default ./resolved.env) as
#   HOPRD_REV=… EDGLI_REV=… BLOKLID_ANVIL_IMAGE=…  so a later promote step can use them.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSIONS="${REPO_ROOT}/versions.toml"
CRATE_CARGO="${REPO_ROOT}/integration/Cargo.toml"
ARCH="${NIX_SYSTEM_SUFFIX:-x86_64-linux}"
RESOLVED_OUT="${RESOLVED_OUT:-${REPO_ROOT}/resolved.env}"

read_toml() { # key.path
  python3 -c "import tomllib,sys; d=tomllib.load(open('${VERSIONS}','rb'));
k=sys.argv[1].split('.');
v=d
[v:=v[p] for p in k]
print(v)" "$1"
}

HOPRD_REV="$(read_toml hoprd.rev)"
EDGLI_REV="$(read_toml edge-client.rev)"
BLOKLID_ANVIL_IMAGE="$(read_toml blokli.image)"

case "${PROJECT:-}" in
  hoprd)       HOPRD_REV="${OVERRIDE_REV:?OVERRIDE_REV required for PROJECT=hoprd}" ;;
  edge-client) EDGLI_REV="${OVERRIDE_REV:?OVERRIDE_REV required for PROJECT=edge-client}" ;;
  blokli)      BLOKLID_ANVIL_IMAGE="${OVERRIDE_IMAGE:?OVERRIDE_IMAGE required for PROJECT=blokli}" ;;
  ""|manual)   echo "no PROJECT override — using all last-known-good pins" ;;
  *) echo "unknown PROJECT '${PROJECT}'" >&2; exit 2 ;;
esac

echo "resolved versions:"
echo "  hoprd        = ${HOPRD_REV}"
echo "  edge-client  = ${EDGLI_REV}"
echo "  bloklid-anvil= ${BLOKLID_ANVIL_IMAGE}"

# ── Preflight: docker daemon up, nix present, chain image pulled ──
bash "$(dirname "${BASH_SOURCE[0]}")/preflight.sh" "${BLOKLID_ANVIL_IMAGE}"

cat >"${RESOLVED_OUT}" <<EOF
HOPRD_REV=${HOPRD_REV}
EDGLI_REV=${EDGLI_REV}
BLOKLID_ANVIL_IMAGE=${BLOKLID_ANVIL_IMAGE}
EOF

# ── Build hoprd + hoprd-localcluster from the pinned rev (cached via Cachix) ──
echo "building hoprd binaries from rev ${HOPRD_REV} ..."
nix build -L "github:hoprnet/hoprd/${HOPRD_REV}#binary-hoprd-${ARCH}" --out-link "${REPO_ROOT}/result-hoprd"
nix build -L "github:hoprnet/hoprd/${HOPRD_REV}#binary-hoprd-localcluster-${ARCH}" --out-link "${REPO_ROOT}/result-localcluster"
HOPRD_BIN="${REPO_ROOT}/result-hoprd/bin/hoprd"
HOPRD_LOCALCLUSTER_BIN="${REPO_ROOT}/result-localcluster/bin/hoprd-localcluster"

# ── Pin edgli to the requested rev and refresh the lockfile ──
echo "pinning edgli to rev ${EDGLI_REV} ..."
python3 - "$CRATE_CARGO" "$EDGLI_REV" <<'PY'
import re, sys
path, rev = sys.argv[1], sys.argv[2]
src = open(path).read()
src = re.sub(r'(edgli\s*=\s*\{[^}]*?\brev\s*=\s*")[0-9a-f]{7,40}(")',
             rf'\g<1>{rev}\g<2>', src, count=1)
open(path, 'w').write(src)
PY
( cd "${REPO_ROOT}/integration" && cargo update -p edgli )

# ── Run the test ──
export HOPRD_BIN HOPRD_LOCALCLUSTER_BIN
export HOPRD_CHAIN_IMAGE="${BLOKLID_ANVIL_IMAGE}"
export HOPRD_E2E_METRICS_PATH="${HOPRD_E2E_METRICS_PATH:-${REPO_ROOT}/metrics.json}"
echo "running integration test ..."
( cd "${REPO_ROOT}/integration" && cargo nextest run --run-ignored all -j 1 )

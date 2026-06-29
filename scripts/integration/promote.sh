#!/usr/bin/env bash
# Promote the just-verified pin for PROJECT into versions.toml (last-known-good).
# Called only on a green run. Reads the resolved value from $RESOLVED_OUT.
#
# Inputs (env): PROJECT, RESOLVED_OUT (default ./resolved.env)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSIONS="${REPO_ROOT}/versions.toml"
RESOLVED_OUT="${RESOLVED_OUT:-${REPO_ROOT}/resolved.env}"

[ -f "${RESOLVED_OUT}" ] || { echo "no ${RESOLVED_OUT}; nothing to promote" >&2; exit 1; }
# shellcheck disable=SC1090
source "${RESOLVED_OUT}"

set_key() { # section key value
  python3 - "$VERSIONS" "$1" "$2" "$3" <<'PY'
import re, sys
path, section, key, value = sys.argv[1:5]
src = open(path).read()
# replace `key = "..."` within the [section] block
pat = re.compile(rf'(\[{re.escape(section)}\][^\[]*?\b{re.escape(key)}\s*=\s*")[^"]*(")', re.S)
new, n = pat.subn(rf'\g<1>{value}\g<2>', src, count=1)
if n != 1:
    sys.exit(f"failed to update [{section}] {key} in {path}")
open(path, 'w').write(new)
PY
}

case "${PROJECT:-}" in
  hoprd)       set_key hoprd rev "${HOPRD_REV}";        echo "promoted hoprd rev → ${HOPRD_REV}" ;;
  edge-client) set_key edge-client rev "${EDGLI_REV}";  echo "promoted edge-client rev → ${EDGLI_REV}" ;;
  blokli)      set_key blokli image "${BLOKLID_ANVIL_IMAGE}"; echo "promoted bloklid-anvil image → ${BLOKLID_ANVIL_IMAGE}" ;;
  *) echo "no PROJECT to promote"; exit 0 ;;
esac

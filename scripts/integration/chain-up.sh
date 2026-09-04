#!/usr/bin/env bash
# Bring up a local HOPR chain (anvil + deployed contracts + bloklid) WITHOUT the
# bloklid-anvil docker image. Replicates docker/blokli-anvil-entrypoint.sh from
# the blokli repo using locally-built binaries, so localcluster can attach via
# `--chain-url` (HOPRD_CHAIN_URL) instead of starting a container.
#
# Blocks serving blokli's GraphQL on :8080 until Ctrl-C; tears anvil down on exit.
#
# Env (all optional):
#   ANVIL_BIN            path to anvil            (default: result-foundry/bin/anvil)
#   BLOKLID_BIN          path to bloklid          (default: result-bloklid/bin/bloklid)
#   DEPLOYER_BIN         path to deployer         (default: result-bloklid/bin/blokli-contract-deployer)
#   CHAIN_DATA_DIR       bloklid data dir         (default: /tmp/hopr-chain)
#   ANVIL_PORT           anvil RPC port           (default: 8545)
#   BLOKLI_API_PORT      blokli GraphQL port      (default: 8080)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ANVIL_BIN="${ANVIL_BIN:-${REPO_ROOT}/result-foundry/bin/anvil}"
BLOKLID_BIN="${BLOKLID_BIN:-${REPO_ROOT}/result-bloklid/bin/bloklid}"
DEPLOYER_BIN="${DEPLOYER_BIN:-${REPO_ROOT}/result-bloklid/bin/blokli-contract-deployer}"
DATA_DIR="${CHAIN_DATA_DIR:-/tmp/hopr-chain}"
ANVIL_PORT="${ANVIL_PORT:-8545}"
BLOKLI_API_PORT="${BLOKLI_API_PORT:-8080}"
ANVIL_RPC_URL="http://127.0.0.1:${ANVIL_PORT}"
CONFIG_PATH="${DATA_DIR}/bloklid-config.toml"

for bin in "${ANVIL_BIN}" "${BLOKLID_BIN}" "${DEPLOYER_BIN}"; do
  [ -x "${bin}" ] || {
    echo "chain-up: missing binary '${bin}'" >&2
    exit 1
  }
done

rm -rf "${DATA_DIR}"
mkdir -p "${DATA_DIR}"

ANVIL_PID=""
cleanup() { [ -n "${ANVIL_PID}" ] && kill "${ANVIL_PID}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# anvil to a file, not the console. At --block-time 1 it narrates every block and
# every RPC call: 4354 of 6973 lines in a two-scenario local run came from anvil
# alone, which drowns the handful of measurement lines the run exists to produce.
# The file stays in DATA_DIR for anyone debugging a chain problem.
ANVIL_LOG="${DATA_DIR}/anvil.log"
echo "chain-up: starting anvil on ${ANVIL_RPC_URL} (log: ${ANVIL_LOG})"
"${ANVIL_BIN}" --host 127.0.0.1 --port "${ANVIL_PORT}" --block-time 1 --accounts 10 --balance 10000 \
  >"${ANVIL_LOG}" 2>&1 &
ANVIL_PID=$!

for _ in $(seq 1 60); do
  curl -sf -X POST "${ANVIL_RPC_URL}" -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null && break
  sleep 0.5
done

echo "chain-up: deploying HOPR contracts"
CONTRACTS_PATH="${DATA_DIR}/contracts-deploy.toml"
DEPLOY_LOG="${DATA_DIR}/deployer.log"
# Same treatment, but surface the log if the deploy fails — without it a failure
# here is a bare non-zero exit with nothing to go on.
if ! "${DEPLOYER_BIN}" --rpc-url "${ANVIL_RPC_URL}" --output "${CONTRACTS_PATH}" \
  >"${DEPLOY_LOG}" 2>&1; then
  echo "chain-up: contract deployment failed — last 40 lines:" >&2
  tail -40 "${DEPLOY_LOG}" >&2
  exit 1
fi

cat >"${CONFIG_PATH}" <<EOF
data_directory = "${DATA_DIR}"
network = "anvil-localhost"
rpc_url = "${ANVIL_RPC_URL}"
max_rpc_requests_per_sec = 0

[database]
type = "sqlite"
index_path = "${DATA_DIR}/bloklid-index.db"
logs_path = "${DATA_DIR}/bloklid-logs.db"
max_connections = 10

[indexer]
fast_sync = false
enable_logs_snapshot = false

[indexer.subscription]
event_bus_capacity = 100
shutdown_signal_capacity = 10
batch_size = 50

[api]
bind_address = "0.0.0.0:${BLOKLI_API_PORT}"
enabled = true
playground_enabled = true

[api.health]
max_indexer_lag = 10
timeout = "5s"
readiness_check_interval = "5s"
EOF
cat "${CONTRACTS_PATH}" >>"${CONFIG_PATH}"
rm -f "${CONTRACTS_PATH}"

# bloklid also to a file: its indexer logs every block it ingests. Readiness is
# detected by polling the GraphQL endpoint (see run-binchain.sh), never by parsing
# this output, so redirecting it costs nothing.
BLOKLID_LOG="${DATA_DIR}/bloklid.log"
echo "chain-up: starting bloklid on 0.0.0.0:${BLOKLI_API_PORT} (log: ${BLOKLID_LOG}, Ctrl-C to stop)"
exec "${BLOKLID_BIN}" -c "${CONFIG_PATH}" >"${BLOKLID_LOG}" 2>&1

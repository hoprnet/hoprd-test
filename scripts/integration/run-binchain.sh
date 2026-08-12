#!/usr/bin/env bash
# Run the integration test against a LOCALLY-BUILT chain (anvil + bloklid) instead
# of the bloklid-anvil docker image. Each scenario gets a fresh chain — parity with
# managed container mode, where localcluster starts a throwaway chain per test.
#
# Prereqs (build first): result-hoprd, result-localcluster, result-bloklid, result-foundry.
#   just build          # hoprd + localcluster
#   just build-chain    # bloklid + anvil
#
# Env:
#   SCENARIOS   space-separated test names (default: "zero_hop one_hop")
#   TEST_TARGET test binary to run them from (default: "integration"; "return_path" for
#               the return-path resilience scenarios)
#   TEST_ARGS   extra libtest args, e.g. "--nocapture" to see a passing scenario's own
#               measurements (libtest swallows them otherwise)
#   others      forwarded to the test (RUST_LOG, HOPRD_PUMP_MBPS, ...) with defaults below
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

export HOPRD_BIN="${HOPRD_BIN:-${REPO_ROOT}/result-hoprd/bin/hoprd}"
export HOPRD_LOCALCLUSTER_BIN="${HOPRD_LOCALCLUSTER_BIN:-${REPO_ROOT}/result-localcluster/bin/hoprd-localcluster}"
export HOPRD_CHAIN_URL="${HOPRD_CHAIN_URL:-http://localhost:8080}"
export RUST_LOG="${RUST_LOG:-info,edgli=debug}"
export RUST_MIN_STACK="${RUST_MIN_STACK:-33554432}"
export HOPRD_PUMP_MBPS="${HOPRD_PUMP_MBPS:-0.5}"

SCENARIOS="${SCENARIOS:-zero_hop one_hop}"
TEST_TARGET="${TEST_TARGET:-integration}"
TEST_ARGS="${TEST_ARGS:-}"
BLOKLI_API_PORT="${BLOKLI_API_PORT:-8080}"

CHAIN_PID=""
stop_chain() {
  [ -n "${CHAIN_PID}" ] && kill "${CHAIN_PID}" 2>/dev/null || true
  # chain-up.sh traps its own anvil; give the process group a moment to unwind.
  pkill -f "result-bloklid/bin/bloklid" 2>/dev/null || true
  pkill -f "result-foundry/bin/anvil" 2>/dev/null || true
  wait "${CHAIN_PID}" 2>/dev/null || true
  CHAIN_PID=""
}
trap stop_chain EXIT INT TERM

# The cargo test process tears its own cluster down on exit, but localcluster's
# SIGINT→hoprd reaping is async and can lag. Stray nodes from a finished scenario
# steal CPU from the next one — on the crypto-heavy 1-hop path that alone tanks
# arrival. Force-reap and let the machine idle before the next cluster starts.
reap_nodes_and_settle() {
  pkill -f "hoprd-localcluster" 2>/dev/null || true
  pkill -f "result-hoprd/bin/hoprd" 2>/dev/null || true
  for _ in $(seq 1 30); do
    pgrep -f "result-hoprd/bin/hoprd|hoprd-localcluster" >/dev/null 2>&1 || break
    sleep 1
  done
  sleep 5
}

start_chain() {
  bash "${REPO_ROOT}/scripts/integration/chain-up.sh" &
  CHAIN_PID=$!
  for _ in $(seq 1 60); do
    curl -sf -X POST "http://localhost:${BLOKLI_API_PORT}/graphql" \
      -H 'content-type: application/json' --data '{"query":"{__typename}"}' >/dev/null 2>&1 && return 0
    kill -0 "${CHAIN_PID}" 2>/dev/null || { echo "chain died during startup" >&2; return 1; }
    sleep 2
  done
  echo "chain did not become ready in time" >&2
  return 1
}

rc=0
for scenario in ${SCENARIOS}; do
  echo "═══ ${scenario}: fresh chain ═══"
  start_chain
  if ! nix develop "${HOPRNET_SHELL:-github:hoprnet/hoprnet}" -c \
    cargo test --manifest-path integration/Cargo.toml --test "${TEST_TARGET}" "${scenario}" \
    --no-fail-fast -- --include-ignored --test-threads=1 ${TEST_ARGS}; then
    rc=1
  fi
  stop_chain
  reap_nodes_and_settle
done
exit "${rc}"

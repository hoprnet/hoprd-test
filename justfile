# Integration throughput test — convenience recipes.
#
# Local quickstart:
#   just integration            # build binaries, preflight, run all scenarios
#   just scenario 0-hop         # run a single scenario against a fresh env
#   just unit                   # fast unit tests (no cluster)
#
# Fast iteration (one cluster, many runs):
#   just cluster-up             # terminal 1: bring up a persistent cluster
#   just attach                 # terminal 2: run scenarios against it
#
# CI-equivalent (build from main/latest via run.sh):
#   just ci

set shell := ["bash", "-uc"]

# Dev shell providing the rust toolchain. Override with a local checkout for speed:
#   HOPRNET_SHELL=path:../hoprnet just integration
hoprnet := env_var_or_default("HOPRNET_SHELL", "github:hoprnet/hoprnet")

# Chain image (override: `just chain_image=… integration`, or set BLOKLID_ANVIL_IMAGE).
chain_image := env_var_or_default("BLOKLID_ANVIL_IMAGE", "europe-west3-docker.pkg.dev/hoprassociation/docker-images/bloklid-anvil:latest")

data_dir := "/tmp/hopr-it"

_default:
    @just --list

# Build local-arch hoprd + hoprd-localcluster binaries from hoprd main (nix,
# Cachix-cached). The localcluster crate is on main. CI builds the pinned rev
# instead (see `just ci` / scripts/integration/run.sh).
build:
    nix build -L github:hoprnet/hoprd#binary-hoprd --out-link result-hoprd
    nix build -L github:hoprnet/hoprd#binary-hoprd-localcluster --out-link result-localcluster

# Verify docker + nix + pull the chain image (idempotent doctor).
preflight:
    bash scripts/integration/preflight.sh '{{chain_image}}'

# Full local run (managed mode): build → preflight → run both tests.
# Optional args = test-name filters (e.g. `just integration zero_hop`).
integration *filter: build preflight
    #!/usr/bin/env bash
    set -euo pipefail
    export HOPRD_BIN="$PWD/result-hoprd/bin/hoprd"
    export HOPRD_LOCALCLUSTER_BIN="$PWD/result-localcluster/bin/hoprd-localcluster"
    export HOPRD_CHAIN_IMAGE='{{chain_image}}'
    export RUST_LOG="${RUST_LOG:-info,edgli=debug}"
    # Debug-build async setup overflows the default thread stack on x86_64 CI.
    export RUST_MIN_STACK="${RUST_MIN_STACK:-33554432}"
    # Safety-net teardown: remove any chain container left behind (localcluster
    # cleans up on graceful exit; this covers crashes/timeouts).
    trap 'docker ps -aq --filter "ancestor={{chain_image}}" | xargs -r docker rm -f' EXIT
    nix develop {{hoprnet}} -c cargo test --manifest-path integration/Cargo.toml --test integration --no-fail-fast {{filter}} -- --include-ignored --test-threads=1

# Run a single test against a fresh env (e.g. `just scenario zero_hop`).
scenario name:
    @just integration '{{name}}'

# Bring up a persistent cluster for iteration (blocks; Ctrl-C to stop). Run in its own terminal.
cluster-up: build preflight
    HOPRD_CHAIN_IMAGE='{{chain_image}}' \
    ./result-localcluster/bin/hoprd-localcluster \
      --size 3 --extra-identities 1 \
      --api-port-base 13000 --p2p-port-base 19000 \
      --api-token test-token-localcluster \
      --hoprd-bin ./result-hoprd/bin/hoprd \
      --data-dir '{{data_dir}}'

# Run tests against the persistent cluster from `cluster-up` (no bring-up).
# Optional args = test-name filters (e.g. `just attach one_hop`).
attach *filter:
    #!/usr/bin/env bash
    set -euo pipefail
    export HOPRD_LOCALCLUSTER_BIN="$PWD/result-localcluster/bin/hoprd-localcluster"
    export HOPRD_CLUSTER_DATA_DIR='{{data_dir}}'
    export RUST_LOG="${RUST_LOG:-info,edgli=debug}"
    export RUST_MIN_STACK="${RUST_MIN_STACK:-33554432}"
    nix develop {{hoprnet}} -c cargo test --manifest-path integration/Cargo.toml --test integration --no-fail-fast {{filter}} -- --include-ignored --test-threads=1

# Fast unit tests (gate + parse logic; no cluster).
unit:
    nix develop {{hoprnet}} -c cargo test --manifest-path integration/Cargo.toml --lib

# Format + compile-check the crate.
check:
    nix develop {{hoprnet}} -c cargo fmt --manifest-path integration/Cargo.toml
    nix develop {{hoprnet}} -c cargo check --manifest-path integration/Cargo.toml --tests

# What CI checks: fmt --check + clippy (-D warnings). Run before pushing.
lint:
    nix develop {{hoprnet}} -c cargo fmt --manifest-path integration/Cargo.toml --check
    nix develop {{hoprnet}} -c cargo clippy --manifest-path integration/Cargo.toml -p hoprd-integration-test --all-targets -- -D warnings

# CI-equivalent: resolve refs (main/latest or overrides), build, run via run.sh.
ci:
    nix develop {{hoprnet}} -c bash scripts/integration/run.sh

# Remove the chain container, stray processes, and temp dirs.
clean:
    -docker ps -aq --filter ancestor='{{chain_image}}' | xargs -r docker rm -f
    -pkill -f result-hoprd/bin/hoprd
    -pkill -f hoprd-localcluster
    -rm -rf '{{data_dir}}' /tmp/hoprd-it-* resolved.env

# hoprd-test

Cross-repo **integration throughput test** for the HOPR stack: stands up a
3-node `hoprd-localcluster` (anvil + blokli + 3 `hoprd` processes, full-mesh
channels) plus a pre-funded edge identity, boots an `edgli` edge client, and
pumps a payload through **0-hop and 1-hop UDP sessions** to the exit node's
built-in loopback — measuring goodput and datagram loss.

It runs on every merge to `main` of `hoprd`, `edge-client`, and `blokli`, on the
shared HOPR self-hosted runner (`self-hosted-hoprnet-bigger`), and **gates the
hoprd → first-network deploy**.

- Test crate: [`integration/`](integration/)
- Version pins: [`versions.toml`](versions.toml)
- CI workflow: [`.github/workflows/integration.yaml`](.github/workflows/integration.yaml)
- Runner: [`runner/README.md`](runner/README.md)

> Legacy k6 load tests live under `k6/` + `echo-service/` and are unrelated to
> the integration test below.

## Framework

The environment is built **once** and shared across scenarios (no teardown
between them):

| Module | Responsibility |
|--------|----------------|
| `cluster.rs` | bring up / attach to `hoprd-localcluster`; contracts are deployed by the chain container (see note below) |
| `env.rs` | `IntegrationEnv`: cluster + booted `edgli` + open channels; `open_udp_session(hops)` session factory |
| `pump.rs` | reusable goodput/loss pump |
| `scenario.rs` | `Scenario` trait + `registry()` + per-scenario gating |
| `scenarios/` | one file per scenario — `zero_hop.rs`, `one_hop.rs`, … |

**Contracts:** the `bloklid-anvil` image deploys the full HOPR contract set on
startup (entrypoint: anvil → `blokli-contract-deployer` → addresses baked into
the bloklid config). The framework never deploys contracts; using the image
gives them for free. Only an external `HOPRD_CHAIN_URL` to a foreign chain would
lack them.

### Adding a scenario

1. Add `integration/src/scenarios/<name>.rs` implementing `Scenario` (`name()` +
   `run(&env, &cfg)`), using `env.open_udp_session(hops)` + `pump::pump_loopback`.
2. Export it in `scenarios/mod.rs` and register it in `scenario::registry()`.
3. Optional floor knob: `HOPRD_E2E_FLOOR_<NAME>_MBPS` (name upper-cased,
   non-alphanumerics → `_`).

Run a subset against the shared env with `HOPRD_E2E_SCENARIOS=0-hop,...`.

---

## What it measures

| Metric | Meaning |
|--------|---------|
| `mbps` | Return **goodput** = bytes echoed back / (first→last byte), MB/s |
| `loss_pct` | `(sent − received) / sent` — UDP is unreliable, some loss is normal |
| `sha_ok` | `true` only on a lossless, byte-identical round-trip |

Sessions are **UDP** (HOPR `Segmentation`-only unreliable socket, no
retransmission), with the exit's SURB egress rate control left **on** — so the
numbers reflect the real rate-controlled path.

### Gates (per scenario)

- **No data returned** → fail (broken path).
- **Corruption** → full payload returned but bytes differ → fail.
- **Loss** > `HOPRD_E2E_MAX_LOSS_PCT` → fail.
- **Goodput** < `HOPRD_E2E_FLOOR_{0,1}HOP_MBPS` → fail.

Defaults leave floors/loss disabled (`0` / `100`) until calibrated on the runner.

---

## Running the test

### Quickstart (`just`)

```bash
just integration         # build binaries, preflight, run all scenarios
just scenario 0-hop      # one scenario, fresh env
just unit                # fast unit tests (no cluster)
just preflight           # docker + nix + chain-image doctor
just ci                  # CI-equivalent: build from versions.toml pins
# fast iteration — one cluster, many runs:
just cluster-up          # terminal 1 (blocks)
just attach 1-hop        # terminal 2
just clean               # tear down container + temp state
```

`just --list` shows all recipes. Set `HOPRNET_SHELL=path:../hoprnet` to use a
local checkout for the dev shell instead of the flake. The rest of this section
documents the underlying env contract the recipes set up.

The test is `#[ignore]` — it needs external binaries + a container runtime.

### Prerequisites

| Var | Required | Meaning |
|-----|----------|---------|
| `HOPRD_BIN` | managed mode | path to a `hoprd` binary |
| `HOPRD_LOCALCLUSTER_BIN` | always | path to a `hoprd-localcluster` binary |
| `HOPRD_CHAIN_IMAGE` | managed mode | a `bloklid-anvil` image tag |
| `HOPRD_CONTAINER_RUNTIME` | no | `docker` (default), `container`, `podman` |
| `HOPRD_CLUSTER_DATA_DIR` | external mode | data-dir of an already-running cluster |

Docker is the only external service: the chain (anvil + blokli + contracts) runs
as a single `bloklid-anvil` container on the host daemon — `localcluster` launches
it with `docker run --platform linux/amd64 -p 8080:8080 …` (auto-pulls if absent)
and removes it on exit. No docker-in-docker. The host just needs the docker daemon
up and registry auth. [`scripts/integration/preflight.sh`](scripts/integration/preflight.sh)
checks both and pulls the image (idempotent — also a local "doctor"):

```bash
scripts/integration/preflight.sh <bloklid-anvil-image-ref>
```

Build the binaries from the [`hoprnet/hoprd`](https://github.com/hoprnet/hoprd) repo:

```bash
nix build -L github:hoprnet/hoprd#binary-hoprd-x86_64-linux              --out-link result-hoprd
nix build -L github:hoprnet/hoprd#binary-hoprd-localcluster-x86_64-linux --out-link result-localcluster
# on macOS use the bare names: .#binary-hoprd and .#binary-hoprd-localcluster
docker pull europe-west3-docker.pkg.dev/hoprassociation/docker-images/bloklid-anvil:latest
```

### Managed mode (test owns the cluster lifetime)

```bash
export HOPRD_BIN=$PWD/result-hoprd/bin/hoprd
export HOPRD_LOCALCLUSTER_BIN=$PWD/result-localcluster/bin/hoprd-localcluster
export HOPRD_CHAIN_IMAGE=europe-west3-docker.pkg.dev/hoprassociation/docker-images/bloklid-anvil:latest
export RUST_LOG=info,edgli=debug

cd integration
cargo nextest run --run-ignored all -j 1
```

The cluster + chain container are torn down automatically on exit.

### External mode (attach to a running cluster — faster iteration)

```bash
# terminal 1: bring the cluster up once and leave it running
hoprd-localcluster --size 3 --extra-identities 1 \
  --api-port-base 13000 --p2p-port-base 19000 \
  --api-token test-token-localcluster \
  --chain-image $HOPRD_CHAIN_IMAGE \
  --hoprd-bin $HOPRD_BIN \
  --data-dir /tmp/hopr-it

# terminal 2: once `hoprd-localcluster status --data-dir /tmp/hopr-it` reports
# "state": "running", run the test repeatedly without re-bringup
export HOPRD_LOCALCLUSTER_BIN=$PWD/result-localcluster/bin/hoprd-localcluster
export HOPRD_CLUSTER_DATA_DIR=/tmp/hopr-it
cd integration && cargo nextest run --run-ignored all -j 1
```

### Tuning knobs

| Var | Default | Meaning |
|-----|---------|---------|
| `HOPRD_E2E_PAYLOAD_BYTES` | `10485760` | payload size, 10–50 MiB |
| `HOPRD_E2E_SCENARIOS` | (all) | comma list of scenario names to run |
| `HOPRD_E2E_FLOOR_<NAME>_MBPS` | `0` (off) | min goodput per scenario, e.g. `HOPRD_E2E_FLOOR_0HOP_MBPS` |
| `HOPRD_E2E_MAX_LOSS_PCT` | `100` (off) | max datagram loss percent |
| `HOPRD_E2E_MAX_SECS` | `600` | per-scenario timeout |
| `HOPRD_E2E_METRICS_PATH` | `metrics.json` | metrics output path |

Unit tests (parse + gate logic, no external deps): `cargo test --lib`.

---

## CI

`integration.yaml` runs on `repository_dispatch[integration]` (fired by the three
source repos on merge) and on manual `workflow_dispatch`. It resolves
[`versions.toml`](versions.toml) (overriding the triggering project's pin),
builds `hoprd` + `hoprd-localcluster` from the pinned rev, pulls the pinned
`bloklid-anvil` image, pins `edgli` to its rev, runs the test, uploads
`metrics.json`, promotes the pin on green, and notifies Zulip on red.

Manual run:

```bash
gh workflow run integration.yaml -R hoprnet/hoprd-test \
  -f project=hoprd -f rev=<sha>          # or -f project=blokli -f image=<ref>
# empty inputs → run all last-known-good pins
```

Runs on the shared `self-hosted-hoprnet-bigger` runner. See
[`runner/README.md`](runner/README.md) for its one requirement (docker), the
repo secrets, and validation steps.

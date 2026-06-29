# Runner

The integration test runs on the **existing shared HOPR self-hosted runner**
`self-hosted-hoprnet-bigger` — the same Hetzner box hoprnet benchmarks use
(`runs-on: self-hosted-hoprnet-bigger`). We do **not** provision a dedicated
machine; we reuse that one.

## Requirements on the runner

That box already has Nix (benchmarks build with it). The integration test adds
one requirement:

- **A docker-compatible runtime** for the chain container (`bloklid-anvil`).
  Confirm `docker info` works for the runner user; if absent, install Docker and
  add the runner user to the `docker` group. Everything else (nix, git) is
  already there.

The job pulls `bloklid-anvil` from GCP AR — the workflow authenticates per run
(`google-github-actions/auth` → `docker login`), so no persistent registry creds
live on the box.

## Repo secrets (hoprd-test)

Set under Settings → Secrets and variables → Actions:

| Secret | Used for |
|--------|----------|
| `GOOGLE_HOPRASSOCIATION_CREDENTIALS_REGISTRY` | GCP auth → pull `bloklid-anvil` |
| `CACHIX_AUTH_TOKEN` | hoprnet/blokli nix caches |
| `ZULIP_API_KEY`, `ZULIP_EMAIL` | red-run notification |

Plus `HOPRD_TEST_DISPATCH_TOKEN` in **hoprd / edge-client / blokli** (Actions
read+write on hoprd-test) so their merge workflows can trigger this one.

Optional repo *variables* (the gates; unset = off until calibrated):
`HOPRD_E2E_FLOOR_0HOP_MBPS`, `HOPRD_E2E_FLOOR_1HOP_MBPS`, `HOPRD_E2E_MAX_LOSS_PCT`,
`HOPRD_E2E_PAYLOAD_BYTES`.

## Validate

1. **Manual CI run:** `gh workflow run integration.yaml -R hoprnet/hoprd-test`
   then `gh run watch -R hoprnet/hoprd-test --exit-status`. Confirms the runner
   picks up the job, GCP login, nix build, and the `metrics.json` artifact.
2. **Real dispatch:**
   ```bash
   gh api repos/hoprnet/hoprd-test/dispatches \
     -f event_type=integration \
     -f 'client_payload[project]=edge-client' \
     -f 'client_payload[rev]=<edge-client main sha>'
   ```
   On green, `versions.toml` gets the promoted pin committed back.
3. **Calibrate gates** from 3–5 green runs' artifacts, then set the repo variables.

## Caveat — shared box

`self-hosted-hoprnet-bigger` also runs benchmarks. The `concurrency: integration`
group only serialises integration runs against each other, not against a
benchmark running at the same time. If throughput numbers look noisy, schedule
around benchmark runs or move to a dedicated runner label.

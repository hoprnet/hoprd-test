# Runner

The integration test currently runs on **hosted `depot-ubuntu-24.04`** runners
(`runs-on: depot-ubuntu-24.04` in `integration.yaml`). Each run is an isolated
VM: docker is preinstalled, and Nix is installed per run by the
`hoprnet/hopr-workflows` `setup-nix` action (which also wires the `hoprnet`
Cachix cache). Nothing to provision.

> A dedicated self-hosted runner (for stable throughput numbers) is a possible
> future change — switch `runs-on` to its label and add that label to
> `.github/actionlint.yaml`. Not used for now.

## Repo secrets (hoprd-test)

Set under Settings → Secrets and variables → Actions:

| Secret | Used for |
|--------|----------|
| `CACHIX_AUTH_TOKEN` | hoprnet nix cache (avoid full compiles) |
| `ZULIP_API_KEY`, `ZULIP_EMAIL` | red-run notification |

The `bloklid-anvil` image is in a **public** GCP Artifact Registry repo
(`hoprassociation/docker-images`, `allUsers` reader) — no registry credentials
needed to pull it.

Plus `HOPRD_TEST_DISPATCH_TOKEN` in **hoprd / edge-client / blokli** (Actions
read+write on hoprd-test) so their merge workflows can trigger this one.

Optional repo *variables*: `HOPRD_REF`, `EDGLI_REF`, `BLOKLID_ANVIL_IMAGE`
(non-triggering-project defaults; unset → main/latest) and the gates
`HOPRD_E2E_FLOOR_0HOP_MBPS`, `HOPRD_E2E_FLOOR_1HOP_MBPS`, `HOPRD_E2E_MAX_LOSS_PCT`,
`HOPRD_E2E_PAYLOAD_BYTES`.

## Triggering / validating

- **On a hoprd-test PR:** add the `run-integration` label → the test runs against
  the current main/latest of all three projects.
- **Manual:** `gh workflow run integration.yaml -R hoprnet/hoprd-test`
  then `gh run watch -R hoprnet/hoprd-test --exit-status`.
- **Simulate a merge trigger:**
  ```bash
  gh api repos/hoprnet/hoprd-test/dispatches \
    -f event_type=integration \
    -f 'client_payload[project]=edge-client' \
    -f 'client_payload[rev]=<edge-client main sha>'
  ```

Concurrency: a new push to a PR cancels that PR's in-progress run; dispatch/manual
runs share a global group that never cancels, so they stack and run one at a time.

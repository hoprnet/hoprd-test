# Flamegraph profiling

System-profiler (samply / cargo-flamegraph) capture of the **Rotsee** integration test
(`integration/tests/rotsee.rs`) against the public testnet. This complements the
executor-yield tokio-console/Perfetto traces (`tests/profiling.rs` +
[`scripts/profile-executor-yield.sh`](../scripts/profile-executor-yield.sh)) with a whole-process
CPU flamegraph.

All commands run from the repo root inside the toolchain dev shell (`nix develop
github:hoprnet/hoprnet`); they build the `integration/` crate with the `flamegraph`
profile (release + debug symbols; see `integration/Cargo.toml`). `samply` /
`cargo-flamegraph` must be on `PATH`.

## Identity setup

The Rotsee test boots on a pre-funded, on-chain-registered Gnosis identity. Export the
same env vars as the test (see the header of `integration/tests/rotsee.rs`):

```sh
# Required
export EDGLI_ROTSEE_BLOKLI_URL='https://blokli.rotsee.gnosisvpn.io'
export EDGLI_ROTSEE_IDENTITY_FILE="$HOME/.fun/gnosis/rotsee/gnosisvpn-hopr.id"
export EDGLI_ROTSEE_IDENTITY_PASSWORD="$(cat "$HOME/.fun/gnosis/rotsee/gnosisvpn-hopr.pass")"
export EDGLI_ROTSEE_SAFE_ADDRESS='0x...'      # from gnosisvpn-hopr.safe
export EDGLI_ROTSEE_MODULE_ADDRESS='0x...'    # from gnosisvpn-hopr.safe
# Required here (unlike edge-client): Rotsee relays do not run the loopback exit service,
# so setup_rotsee() needs an explicit exit node.
export EDGLI_ROTSEE_EXIT_NODE='0x...'
export RUST_LOG='info,edgli=debug'
```

Pick one scenario to profile: `rotsee_zero_hop` (0-hop) or `rotsee_one_hop` (1-hop).

---

## macOS

`cargo flamegraph --root` launches the binary via Instruments, which does not inherit the
calling shell's environment. Use `samply` instead — it runs the binary as a direct child
process, so the `EDGLI_ROTSEE_*` env vars are inherited naturally.

```sh
cd integration
cargo build --profile=flamegraph --test rotsee
BINARY=$(ls target/flamegraph/deps/rotsee-* | grep -v '\.d$' | head -1)
samply record -o "/tmp/$(date +%Y%m%d-%H%M%S).json" \
  "$BINARY" --ignored --nocapture rotsee_zero_hop
```

Load the saved profile (opens the [Firefox Profiler](https://profiler.firefox.com)):

```sh
samply load /tmp/<timestamp>.json
```

### Verifying the result

- Exit code is `0` and the session pump reports a SHA-256 match in stdout.

---

## Linux

Relax kernel sampling permissions (resets on reboot):

```sh
sudo sysctl -w kernel.perf_event_paranoid=1
```

```sh
cd integration
cargo flamegraph \
  --profile=flamegraph \
  --test rotsee \
  --output "/tmp/$(date +%Y%m%d-%H%M%S).svg" \
  -- --ignored --nocapture rotsee_zero_hop
```

### Verifying the result

- Exit code is `0` and the session pump reports a SHA-256 match in stdout.
- The `.svg` is >200 KB — a smaller file means the sampler captured no useful data.
- Open the `.svg` in a browser. If frames show `??` addresses, the binary was stripped;
  confirm `--profile=flamegraph` was passed.

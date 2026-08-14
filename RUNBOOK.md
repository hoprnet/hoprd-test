# Runbook — return-path resilience cluster test

Every rerun follows this sequence. No step is optional. The verification step exists because
**four separate runs were invalidated** by a participant silently running code that predated the
change under test, and the failure is indistinguishable from "the fix does not work".

## Participants and which build each runs

| participant | role | build |
| ----------- | ---- | ----- |
| entry (in-process `edgli`) | opens the session, **mints SURBs, selects return paths** | linked into the cargo test binary from `integration/Cargo.toml` |
| relayers + exit | forward packets, reply | `$HOPRD_BIN`, built from the hoprd worktree |
| chain | anvil / blokli | nix `result-*` |

The entry is the only participant whose return-path selection matters. A change that is not in
the entry cannot affect recovery, no matter how many nodes carry it.

## Sequence

Let `TIP` = the stack-tip commit of the hoprnet worktree.

### 1. Push the new code to the tip of the stack

```sh
cd <hoprnet-worktree>
cargo nextest run --lib -p hopr-transport && cargo clippy --workspace --all-targets && nix fmt
git commit -am "<conventional message>" && git push
TIP=$(git rev-parse HEAD)
```

Never test uncommitted hoprnet code — the other two repos can only pin a pushed rev.

### 2. Bump edge-client to `TIP`, push

```sh
cd <edge-client-worktree>
perl -pi -e "s/rev = \"[0-9a-f]{40}\"/rev = \"$TIP\"/g" Cargo.toml   # /g — there is more than one
nix develop github:hoprnet/hoprnet -c cargo update -p hopr-lib && nix develop github:hoprnet/hoprnet -c cargo check || exit 1
git commit -am "chore(deps): bump hopr-lib to $TIP" && git push
EDGE=$(git rev-parse HEAD)
```

### 3. Bump hoprd to `TIP`, push, build

```sh
cd <hoprd-worktree>
perl -pi -e "s/rev = \"[0-9a-f]{40}\"/rev = \"$TIP\"/g" Cargo.toml   # hopr-lib AND hopr-utils-session
nix develop github:hoprnet/hoprnet -c cargo update -p hopr-lib -p hopr-utils-session
nix develop github:hoprnet/hoprnet -c cargo build --release -p hoprd || exit 1   # abort on failure, never fall through to a stale binary
git commit -am "chore(deps): bump hopr-lib to $TIP" && git push
```

`nix develop github:hoprnet/hoprnet -c` for **every** build: it is the only shell that exports
`tokio_unstable`. The edge-client and hoprd-test shells do not.

### 4. Point the harness at both

```sh
cd <hoprd-test-worktree>            # the WORKTREE. Reading the main checkout tells you nothing.
# integration/Cargo.toml: edgli = { git = ".../edge-client", rev = "$EDGE", ... }
nix develop github:hoprnet/hoprnet -c cargo update -p edgli --manifest-path integration/Cargo.toml
```

A local `path = ` dependency is acceptable while iterating, but it must become `$EDGE` before any
result is reported or committed — a path dep makes the run unreproducible.

### 5. Every configuration must be set on **both** node types

There are two independently configured participants -- the in-process `edgli` entry
(`integration/src/env.rs`) and the `hoprd` nodes (`hoprd/src/config.rs`) -- and they do **not**
share a config path. Anything that changes protocol behaviour has to be stated in both, or the
cluster measures a mixture of two configurations and attributes the result to neither.

Library defaults are not a safe fallback: `SurbPopOrder` defaults to `Fifo`, and hoprd pins `Lifo`
while `edgli` inherited the default -- so for a long time the two ends disagreed and every reading
of return-path behaviour was against a mismatched pair. Do not rely on a default being "obviously"
what you want; write it down on both sides even when the value happens to match.

Checklist before any run, for each behavioural setting:

- [ ] stated explicitly in `integration/src/env.rs` (entry)
- [ ] stated explicitly in `hoprd/src/config.rs` (relayers and exit)
- [ ] the two agree, or the difference is deliberate **and** written down here

Current settings under this rule: `pop_order`, `sustain_on_return_path_loss`, `flow_control`,
`surb_management` (target buffer and mint ceiling), mixer delays.

### 6. Verify before running — the step that catches everything

```sh
# a) exactly one hopr-lib, at TIP, in every lock
grep -A2 'name = "hopr-lib"' <hoprd-test-worktree>/integration/Cargo.lock | grep -c "$TIP"   # must be 1
grep -c 'name = "hopr-lib"'  <hoprd-test-worktree>/integration/Cargo.lock                    # must be 1

# a2) all four [patch.crates-io] tables agree -- hoprnet, edge-client, hoprd, hoprd-test.
# Each repo carries its own copy of the same three revs and nothing enforces agreement.
# The harness workspace supplies the patch table for the *entry* build, so a stale rev there
# silently excludes the change from the only participant whose path selection matters.
for f in <hoprnet>/Cargo.toml <edge-client>/Cargo.toml <hoprd>/Cargo.toml \
         <hoprd-test>/integration/Cargo.toml; do
  echo "== $f"; grep -E 'hopr-(api|utilities|network-graph) = \{ git' "$f"
done   # the three revs must be identical in all four

# b) the binaries actually contain the change — pick a string unique to it
MARKER='return path silent, re-planned'
strings "$HOPRD_BIN" | grep -qc "$MARKER" || echo "HOPRD MISSING THE CHANGE"
strings <test-binary>  | grep -qc "$MARKER" || echo "ENTRY MISSING THE CHANGE"
```

(b) is not redundant with (a). A lock can be right while the binary on disk is stale, and
`tracing` is built with `release_max_level_debug`, so anything logged at `trace!` is compiled out
and unobservable regardless of what the lock says.

### 7. Run — one at a time

```sh
HOPRD_KEEP_ARTIFACTS=1 \
HOPRD_BIN=<hoprd-worktree>/target/release/hoprd \
TEST_TARGET=return_path TEST_ARGS=--nocapture \
SCENARIOS=session_should_survive_return_relayer_loss \
  bash scripts/integration/run-binchain.sh
```

`HOPRD_KEEP_ARTIFACTS=1` always — without it the node logs are deleted at teardown and a failed
run yields nothing. `HOPRD_KILL_SETTLE_SECS` is deliberately *not* set: the scenario's own 4 s
settle is part of what it measures, and forcing it to 0 makes the survival phase race packets that
were already in flight when the relayer died. Override it only for a one-off experiment. One run at a time: the cluster binds fixed ports and this is a single machine.

**Redirect with `>`, never pipe into `tail`/`head`.** A pipe buffers the whole run, so the log stays
empty until the process exits and the two-minute cadence has nothing to read — and worse, the
pipeline's exit status becomes `tail`'s, so a *failed* test reports success. One run was read as
passing for exactly that reason. `ps` is the better liveness signal anyway: it shows which binary
each node is running, and the kill is directly visible as a node disappearing.

### 8. Report progress every two minutes until the result is known

A run takes ten to fifteen minutes and produces nothing until it ends. Poll the output file on a
two-minute cadence from launch until the run resolves, and report each time — bootstrap progress,
node count, whether the warm-up has started, the drain, the kill, the settle, the survival phase.

Say "still bootstrapping" when that is all that is true. A silent wait is indistinguishable from a
hung run, and the whole point of a two-minute cadence is that a run which has already failed gets
killed and relaunched in two minutes rather than at the fifteen-minute mark.

### 9. Read the result

- **Log timestamps are UTC; file mtimes are local.** A kill logged at `11:57:13Z` happened at
  13:57:13 local. Compare like with like before concluding a binary predates a run.
- All lines in the test stdout come from the **in-process entry**. Node logs are separate files.
  A tracing target of `hopr_transport` in stdout is the entry, not a relayer.
- Recovery is `time_to_sustain(target_mbps, window)` over **attributed** bytes only, timed from
  the first byte the survival phase offered. `time_to_sustain` now refuses to answer before a full
  window has elapsed, so an opening burst can no longer satisfy it.
- Read `outcome` first. `NeverStarted` / `SessionClosed` mean nothing was serving the session, and
  every other number in that run is about a stream that had no counterparty.
- Read `foreign` next. Non-zero means warm-up traffic surfaced during the survival phase; it is
  excluded from the figures, but a large value means the drain failed and the phases are mixed.
- Healthy-run throughput varies 1–45 %. A single run cannot establish an improvement; compare
  against the spread, not against one prior number.
- **Strip ANSI before grepping structured fields.** `tracing` wraps *field names* in escape codes,
  so `grep -c 'sessions=1'` returns zero on a line that plainly contains `sessions=1`. Pipe through
  `sed -E 's/\x1b\[[0-9;]*m//g'` first. This has twice produced a confident wrong reading of
  whether a mechanism engaged.
- **Check the baseline before reading anything else.** The harness aborts when the pre-kill pump
  is broken, and every post-kill number in that run is meaningless. A collapsed baseline is itself
  the finding — it means the change under test broke a healthy session.

## What the survival scenario measures

**warm up (2 MB, phase tag 1) → drain to quiet → kill → settle 4 s → offer phase tag 2 at half the
measured baseline for 60 s.**

Each element is load-bearing, and each replaced something that made an earlier run unmeasurable:

| element | what it prevents |
| ------- | ---------------- |
| distinct phase tags in the payload | a released backlog counted as the later phase recovering |
| drain to quiet before the kill | warm-up traffic landing inside the survival window |
| settle after the kill | the survival phase racing packets already in flight when the relay died |
| paced load for 60 s | the payload being fully committed before recovery can happen |

The session is **unreliable** — there is no retransmission — so bytes lost during the outage never
arrive and 100 % arrival is unreachable by construction. The headline is therefore *when the
delivered rate returns*, never total arrival.

## Acceptance criterion

The survival phase reaches 50 % of the measured baseline rate and **holds it to the end of the
pump**, having never gone quiet for longer than the deadline. Boundary **20 s**, design aim **15 s**,
both timed from the first byte offered; add the 4 s settle for the interval measured from the kill.

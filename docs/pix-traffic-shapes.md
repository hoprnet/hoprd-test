# PIX under end-user traffic shapes

What a PIX Session does under the traffic a VPN client actually produces, measured rather than
derived. The scenarios are `integration/tests/pix_shapes.rs`; the profile they run at is
`integration/src/shapes.rs`.

Run them with:

```bash
HOPRD_SRC=../hoprd-shapes just pix-shapes            # all of them, hours
HOPRD_SRC=../hoprd-shapes just pix-shapes <scenario> # one, ~8-15 min
```

`HOPRD_SRC` must be a hoprd carrying the `--pix-config` seam. `just pix-shapes` refuses to run
without it, because a `hoprd-localcluster` that ignores `--pix-config` silently runs the demo
geometry and every assertion below would then be measuring a cycle 1 280x smaller than it claims.
Exit-side PIX fill (hoprnet#8396) is no longer a condition worth stating: it has been on hoprd
`main` since hoprd#166.

All three sides of a run must still be on one hoprnet rev — **`11b5f1b6`** as of this writing.
A skew is not subtle but it is silent from here: two sources put two `hopr-lib`s in the lock, the
entry runs one and registers its metrics in the other, and every counter reads zero.

**Agreeing on the commit is not enough — the git _reference_ has to match too.** edge-client#170
moved its own pin from a `rev` to `branch = "master"`, and naming a `rev` here that resolves to the
identical commit still splits the graph. Measured on this manifest:

```
git+https://github.com/hoprnet/hoprnet?branch=master#11b5f1b6...
git+https://github.com/hoprnet/hoprnet?rev=11b5f1b6...#11b5f1b6...
```

Two entries, same commit. So `integration/Cargo.toml` tracks `master` because edgli does, and the
exact commit lives in `Cargo.lock` — set with `cargo update -p hopr-lib --precise <sha>`, which is
reproducible for anyone building from the committed lock. The cost is that a bare `cargo update`
walks to hoprnet's tip, which is not necessarily what the Exit binary was built from; check it
against `hoprd`'s `Cargo.toml` when you touch the lock.

**A dependency's own lock is ignored by its consumers, which is how a green CI hides a break.**
hoprnet#8430 dropped `pix_ssa_quota` from `HoprSessionClientConfig`; edgli `main` still filled it,
and did not notice, because edgli's lock held `hopr-lib` several commits behind the very branch its
manifest names. From here the branch resolves to its tip and the build simply fails. Fixed in
edge-client#175. Expect this shape of failure again: edgli's CI being green says nothing about
whether it builds at `master`'s tip.

## The profile

```
parts 512 x (threshold 64 + surplus 16)    E     = 40 960 packets/cycle
R     = 150 packets/s  (~3.9 Mbps)         cycle = 273 s nominal
quota = 40 960 x 3246                            = 132 956 160 B (126.8 MiB)
```

Until the 3246 B payload this was 1024 parts at 300 packets/s. Halving both keeps the cycle length,
so every ratio below is unchanged, and halves the quota that the recovery floor is computed from.

**Not the deployed geometry, and deliberately so.** What governs PIX is ratios, not rates: the
client's SURB buffer is `16 x R` and a cycle is `cycle_seconds x R`, so `buffer / E = 16 /
cycle_seconds` and the packet rate cancels. A buffer that is a realistic fraction of a cycle
therefore depends on the cycle _length_ alone, and a ~4.5 min cycle reproduces the deployed 5.2 %
at a rate a 1-hop local cluster carries comfortably. The deployed 4608 x 80 at 10 Mbps would be
10-15 min per cycle and put a full pass out of reach.

| quantity                        | value                          | deployed       |
| ------------------------------- | ------------------------------ | -------------- |
| SURB buffer                     | 2 400 SURBs (5.9 % of `E`)     | 19 264 (5.2 %) |
| free credit (`parts x surplus`) | 8 192                          | 73 728         |
| `max_served_without_progress`   | 2048 (credit covers the queue) | 2048           |
| `max_recovery_time`             | **15 min**                     | 2 h            |
| `fill.finish_fraction`          | **0.6** (aim point 540 s)      | 0.75           |
| fill rate an idle cycle needs   | 80 packets/s                   | 72 packets/s   |
| `fill.max_rate`                 | 250                            | 250            |

`max_recovery_time` and `fill.finish_fraction` are the deliberate departures. The deadline is no
longer only a backstop: since the Exit fills a cycle the application left unfinished, it is also
the idle tariff, and an idle scenario spends `finish_fraction x` it. Two hours is not a thing a
test can wait out. 15 min clears the floor `validate_incoming_session_pix_config` enforces
(`quota_range_max / 57 packets/s` = 843 s at the 3246 B payload, 1.5 Mbps in packets; see
hoprnet#8469), and 0.6 puts the aim point at 540 s, what the idle, browsing and upload shapes have
always waited. Both are legal configuration rather than a test-only escape hatch; the fraction is
hoprd's `fill_finish_fraction`, exposed for this in hoprd#187.

## Results

Measured on a 3-node local cluster, 1 hop, binary chain, at the previous profile (1024 parts at
300 packets/s, 1038 B payload, 12 min deadline at the upstream fraction) on 2026-09-23. The ratios
the profile is built on are unchanged, so the conclusions carry over; the absolute bytes, rates
and deposits halve.

**At the current profile** (512 x 80 at 150 packets/s, 3246 B payload, 15 min deadline, fill
fraction 0.6), measured 2026-10-01 against hoprd#187 and hoprnet `a065fa2`: all six pass in
**63 min of test time**, 72 min wall clock including the hoprd build and a chain boot per
invocation. Per scenario, cluster bring-up included:

| scenario       | time  |
| -------------- | ----- |
| geometry spike | 533 s |
| browsing       | 700 s |
| download       | 545 s |
| mixed          | 881 s |
| idle           | 640 s |
| upload         | 502 s |

The table below is the earlier profile's.

Counters are the Exit's `hopr_strategy_pix_*` delta over the scenario; **paid** is the rise in the
Exit's _Safe balance_, read from the chain. Those two columns were read at hoprnet **`57b5e679`**.
The **wall** column carries that run and the re-run at **`11b5f1b6`**. All six pass at both revs,
under the same assertions, payment floor included.

| shape              | traffic offered                           | recovered | swept | deposits | paid (wxHOPR)       | wall `57b5e679` | wall `11b5f1b6` |
| ------------------ | ----------------------------------------- | --------- | ----- | -------- | ------------------- | --------------- | --------------- |
| **geometry spike** | 88 MB at 300 pkt/s, loopback              | 1         | 1     | 2        | 0.08503296 = **1×** | 593 s           | 595 s           |
| **idle**           | 25 keep-alives of 32 B, one per 25 s      | 1         | 1     | 2        | 0.08503296 = **1×** | 817 s           | 795 s           |
| **browsing**       | 40 kB bursts every 3 s (~13 kB/s), 540 s  | 1         | 1     | 2        | 0.08503296 = **1×** | 745 s           | 712 s           |
| **download**       | service pushes 2 cycles at 300 pkt/s      | 2         | 2     | 3        | 0.17006592 = **2×** | 753 s           | 719 s           |
| **upload**         | 300 pkt/s into a sink, nothing returns    | 1         | 1     | 2        | 0.08503296 = **1×** | 690 s           | 690 s           |
| **mixed**          | browse 180 s → quiet 120 s → bulk 1 cycle | 2         | 2     | 3        | 0.17006592 = **2×** | 1113 s          | 1113 s          |

Not one scenario recorded a deposit timeout, and none was closed by the supervisor.

### The mixed shape is the one that notices a busy machine

It failed once at `11b5f1b6`, on a host that had other work on it, and passed on a re-run of the
same binaries at 1112.84 s — within a second of its `57b5e679` figure. So it is **not** a
regression in this rev range. It is worth writing down anyway, because the failure is specific to
this shape and reproducible in kind rather than in schedule:

```
08:04:44  quiet begins (120 s, no application traffic at all)
08:04:54  every p2p connection drops:  num_peers 2 → 1 → 0
08:04:58  "cannot find 1 hop path ... in the channel graph" begins
08:06:26  peers reconnect (2), 08:06:59 (3)
08:07:46  bulk gives up: 0/88473600 B, ttfb never, 60 s idle budget spent
08:08:06  path resolution recovers — 20 s too late
```

No channel closed on chain and the supervisor never intervened — this is the transport, not the
strategy. The peers came back on their own; what did not come back in time was the _channel graph_,
unresolvable for ~100 s after the connections were restored, and the bulk phase's 60 s idle budget
expires inside that window.

Mixed is the only shape with a fully silent interval — idle still trickles 32 B every 25 s, which
is enough to hold the connections up. **A wholly quiet Session is therefore the one that has to
survive a reconnect, and on a loaded host the channel graph can take longer to recover than an
application is willing to wait.** Run this suite on an otherwise idle machine; if mixed fails here
again, check `num_peers` before suspecting PIX.

**Every scenario's Safe delta was an exact whole multiple of the per-SSA deposit** — `1×` or `2×`
of 0.08503296 wxHOPR, matching the cycles its counters claimed, with no residue from relayed-ticket
income. The assertion only enforces a floor (see `assert_exit_was_paid` for why), but exactness
held in all six at `57b5e679`. At `11b5f1b6` only the floor is known to have held: the harness
prints a scenario's own counters on failure, not on success, so the exact multiples were not
re-read there.

This matters because the counters alone cannot establish it. `keys_recovered` and `sweeps` are the
Exit's own bookkeeping, and there is a path where both increment and no money moves: a cycle that
completes before its deposit is mined leaves the Exit recovering a key against a zero balance,
logging "already swept", with the funds stranded at the stealth address. Until the balance check
was added, all six scenarios would have reported success against an Exit that was never paid.

Traffic that had to round-trip did: 100 % arrival on the spike, on the idle liveness echo
(7 200/7 200 B) and on the mixed browsing phase; 99.9 % on the mixed bulk phase. The upload's
sink absorbed everything offered and returned nothing, which is the shape.

**The two shapes that carry no return traffic of their own — idle and upload — completed their
cycles and funded their successors anyway.** That is Exit-side fill (hoprnet#8396) working end to
end through a real chain, and it is the result this whole exercise was for: before it, both of
those clients stranded every deposit they made while paying for the quota.

### What the numbers say

**The achieved packet rate is ~232/s against 300 offered** (0.21 Mbps of 0.27), so an achieved
cycle runs about 1.3x nominal rather than the 2-3x the deployed profile's docs predict. The gap is
the local cluster's near-zero transit: the SURB pipeline that stretches a deployed cycle is mostly
latency, and there is almost none here. **This is the profile's main fidelity limit** — see below.

**Browsing is much closer to idle than to busy.** 40 kB every 3 s is ~13 kB/s, which is ~14 return
packets/s against the ~114/s a cycle of this geometry needs inside its deadline. So a browsing
client's cycles are completed by _fill_, not by the browsing. The first version of that scenario
asked for two cycles' worth of packets at that rate — a payload nearly four hours long — and
stopped 4 % in.

**`max_served_without_progress` stays at upstream's 2048.** The free credit (16 384) covers the
queue (4 800) by more than 3x, so the drain after a recovery is credited as liveness and the gate
never blocks part-way through it. This contradicts `hoprd/EXIT_USER_GUIDE.md` §7 and
`PIX-TUNING.md` §7, which both still say to raise it to 20 000; hoprnet's current supervisor
documents the flat 2048 as safe at any dimensions because `RecoveryProgress` now follows
`shares_seen` rather than `useful_shares`. Nothing here needed it raised. **Those two documents
should be corrected.**

**A download completes cycles about twice as fast as anything else**, and for the expected reason:
it is the only shape whose application traffic saturates the direction PIX bills, so it swept two
cycles in the time the others took to sweep one. Fill has nothing to make up on it.

### The egress gate, read directly

The 2048 paragraph above infers that the gate never blocked from the sweeps landing on time. The
scenarios now read it: `src/pix_exit.rs` samples the Exit's `hopr_pix_*` family every 2 s, and every
shape asserts on it (`assert_the_gate_served_the_surplus`). Measured 2026-10-04 at the current
profile against hoprd `dfd0fce` (hoprd#187) and hoprnet `a065fa2`, the spike in its own invocation
and the other five sharing one cluster, as `just pix-shapes` runs them: all six pass in 63 min of
test time (541 s + 3 261 s), 80 min wall clock including the hoprd and chain builds.

| shape          | recovered | useful | surplus | longest surplus-only run | samples     | `share_lag` blocks |
| -------------- | --------- | ------ | ------- | ------------------------ | ----------- | ------------------ |
| geometry spike | 1         | 41 305 | 8 191   | 3 912                    | 190 / 378 s | none               |
| browsing       | 1         | 32 774 | 8 192   | 4 058                    | 271 / 540 s | none               |
| download       | 2         | 65 536 | 14 140  | 3 903                    | 265 / 528 s | none               |
| mixed          | 2         | 65 536 | 14 802  | 4 248                    | 428 / 855 s | none               |
| idle           | 1         | 39 589 | 9 689   | 3 983                    | 313 / 624 s | none               |
| upload         | 1         | 32 768 | 5 127   | 4 009                    | 245 / 488 s | none               |

`useful` and `surplus` are the scenario's before/after delta; the run and the samples are the
trace's. Every recovered cycle also recorded an accepted-share fraction above 1.0, and not one of
the trace's 1 712 scrapes failed.

**The gate never parked on share lag, in any shape, at the ends or in between.** That is the 2048
conclusion above measured at the gate rather than inferred from the sweeps: at this profile the free
credit (8 192) covers the queue (2 400) more than 3x, and no shape came near the ceiling.

**`SURPLUS_RUN_USEFUL_TOLERANCE` stays at zero.** Every shape produced a contiguous surplus-only run
of 3 903 or more, against a window's 4 096 and a bar of 2048, so the 3 % fallback its comment
describes was not needed. What is missing below 4 096 is the run's edges: a sample step that also
carries the neighbouring useful shares is discarded whole. A run can also come out _longer_ than a
window, as mixed's did, because upstream counts as surplus every accepted share that did not advance
reconstruction — the negotiated surplus, duplicates, and the tail a cycle keeps receiving after it
reached its target.

**Useful shares above a cycle's 32 768 are its successor's first ones.** The spike shows it in
isolation: alone on its cluster, it read 8 537 beyond its one cycle. That matters because the family
is Exit-wide with no Session label, so on a shared cluster a scenario's deltas could also hold the
previous scenario's tail. Download, mixed and upload read exact multiples of 32 768, so nothing
leaked into those three; idle's 6 821 extra could be either, and the family cannot say which. It
did not decide anything here, but it could: a leaked `share_lag` episode fails whichever scenario
it lands in, and a leaked recovered cycle can satisfy the accepted-fraction check on its own. A
shape that fails on the gate only when it runs after another should be re-run alone
(`just pix-shapes <scenario>`) before the gate is suspected.

## Two findings that are not about PIX, and one correction

**The entry closed its own channels ten minutes in, twice, for two different reasons.**
`close_below_quality_score` defaults to 0.3 and is separate from the eligibility threshold this
harness already zeroes. Probing needs traffic to score a peer; an idle shape offers 32 bytes every
25 s; the score decays and the strategy closes the channel underneath a Session that is working
perfectly. Measured: channels opened at T+0, closed at T+10m07s, then 17 522 consecutive
`cannot find 1 hop path` failures.

Zeroing that threshold was not enough — a later run closed two of three channels at T+10m07s again.
The close pass stops only when `remaining_open <= min_open_channels`, and the harness set that floor
to 1 while opening 3. `env.rs` now sets the floor equal to the target, which forbids the close pass
outright regardless of which trigger fires; the quality threshold stays as defence in depth.

For a deployment this is worth knowing rather than alarming — a real network has more relays and
more probing traffic — but an idle VPN client is exactly the case that produces neither, and the
interaction between a quiet Session and quality-scored channel closure is real.

**The echo pump cannot express an asymmetric shape.** `pump_halves`' reader decides completion
against the payload that was _sent_, because every other scenario here targets the Exit's loopback.
A download's reply volume is the service's choice, so the pump declared `Complete` after 0.23 s
against a 491 s push; an upload's is zero, so it would have declared `NeverStarted` at 30 s. Both
shapes now drive the Session directly.

**The asymmetric scenarios used to run 20 minutes past their own measurement.** `drain_for` and
`offer_for` ran to their full budget rather than stopping when the sweeps landed, so the download
kept reading for 20 minutes after the service had pushed its last byte. It passed either way — the
cost was wall-clock, and it is worth stating as wall-clock: the download took **1922 s** before the
stop flag and **715 s** after, for the same result.

An earlier revision of this file claimed the same change fixed a CPU spin, on the strength of a
process sampled at ~7.5 cores. That was a misdiagnosis and is withdrawn: the process sampled was a
later scenario's binary, not the download's, which had already exited; and a test binary hosting
the edgli Entry in-process alongside five `hoprd` nodes, anvil and blokli on one machine is
expected to be busy. Nothing here measured what an idle Session costs.

## Fidelity limits

- **Transit is a memcpy.** All three nodes are on localhost, so the round trip is sub-millisecond
  and a shallower SURB buffer suffices than a deployment needs. The absolute buffer depth here does
  not transfer; the _ratio_ is what these runs are about. `cluster::request_latency_profile()` can
  simulate a WAN RTT and a run that cares should say what it simulated.
- **One client.** Nothing here measures an Exit serving several Sessions at once, which is where
  `max_live_cycle_bytes` and the uplink start to bind.
- **The price is scaled.** 1e-9 wxHOPR/B rather than the deployed 5.33e-8, because the cluster
  funds each node's Safe from a fixed pot. Nothing in the protocol reads the absolute figure — both
  sides check the _product_ with the quota — so the exchange measured is the same one.

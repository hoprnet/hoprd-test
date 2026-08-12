# Return-path resilience — scenario catalogue

Scenarios for the weaknesses behind the 2026-08-11 `gnosis_vpn-client` return-path break,
and the fixes for them: [hoprnet#8328] (SURB pop order), [hoprnet#8329] (invalidate
relayers whose channel closed), [hoprnet#8331] (return-path diversity), [hoprnet#8330]
(frame max-age).

Section references (§) are to the [HOPR protocol summary][summary] at the commit the
`hopr-debug` skill pins. They are the reason each scenario is shaped the way it is —
several obvious-looking designs measure nothing, for reasons that only the protocol
explains.

[hoprnet#8328]: https://github.com/hoprnet/hoprnet/pull/8328
[hoprnet#8329]: https://github.com/hoprnet/hoprnet/pull/8329
[hoprnet#8330]: https://github.com/hoprnet/hoprnet/pull/8330
[hoprnet#8331]: https://github.com/hoprnet/hoprnet/pull/8331
[summary]: https://github.com/hoprnet/rfc/blob/0b1eb50cf8e11a312ce3f29e723fc97e1d47bf32/SUMMARY.md

## Design constraints that apply to all of them

**The return path is chosen by the SURB creator, not the replier** (§2.4). A SURB is a
pre-built return header; the exit can only use one as given. So return-path *selection*
lives in the client (`edgli`), and any scenario testing selection must vary the **edgli**
build. The exit's `hoprd` build governs SURB *storage* — pop order (#8328) and relayer
invalidation (#8329) — so those need the **hoprd** build varied instead. Getting this
backwards produces a test that cannot move.

**Measure the return direction in isolation.** Open the session **0-hop forward, 1-hop
return**. Then no cluster node relays anything outbound, and each node's
`hopr_packets_count{type="forwarded"}` counts exactly the replies it carried — a
return-relayer histogram (`src/relayers.rs`). With a symmetric 1-hop session the forward
relay's count swamps the signal.

**Relayers must have different edge scores or nothing is measurable.** Edge score is
probe-success-rate × a **step function** of latency (§6.3):

| delay   | score |
| ------- | ----- |
| ≤75 ms  | 1.00  |
| ≤125 ms | 0.70  |
| ≤200 ms | 0.30  |
| >200 ms | 0.15  |
| no data | 0.05  |

Path value is the product of edge costs, and paths are sampled **weighted-random** by that
value. On an unshaped local cluster all four relayers score identically, so weighted-random
*is* uniform and no selection strategy is distinguishable from another — this was measured,
not assumed (see Results). Shape inter-node latency with
`cluster::request_latency_profile`, one node per step; evenly-spaced milliseconds waste
candidates on duplicate scores.

**A 5-node cluster cannot reproduce path pruning.** `hoprd-localcluster` caps at
`MAX_NUM_NODES = 5`, giving the exit 4 return-relayer candidates. Path-finding caps
`max_paths = 8` (§6.3), so with 4 candidate paths the truncation half of the original root
cause never fires. Only the weighted-draw half is testable here; the pruning half needs a
network larger than the local cluster.

**Use the right statistic.** With only 4 candidates, an even rotation gives 25% each and a
weight-proportional draw still only reaches ~36–49% for the best one, so a cap on maximum
share cannot separate them (and flips sign run to run). Use `RelayerSpread::imbalance` —
busiest ÷ least-busy — which is ≈1.0 for a rotation and tracks the score ratio otherwise.

## Scenarios

### S1 — Selection spread under skewed scores · **implemented**

*Isolates:* #8331 — bucket by first relayer, sample K distinct buckets without
replacement, round-robin between them, versus an independent weighted draw per SURB.

*Setup:* 5 nodes, latency profile one node per score step, 0-hop forward / 1-hop return,
4 MiB pump. Vary the **edgli** pin.

*Signal:* `imbalance`. Round-robin over all 4 buckets is uniform *by construction*
(K = min(6, 4) = 4, so every bucket is chosen then cycled) → ≈1.0. A weighted draw tracks
the score ratio → >2.

*Test:* `return_paths_should_spread_across_distinct_relayers`.

### S2 — Return relayer dies (SIGKILL) · **implemented, characterisation only**

*Intended:* survivability when a relay vanishes without closing anything.

*Actual:* does not discriminate — see Results. Arrival lands at ~55% whether the killed
relayer carried 25% or 49%, on both stacks. Killing a node removes it from *everything*
at once (transport, probing, all four of its channels), and the session enters a
~0.01 MB/s crawl that the pump's 10 s read-idle timeout ends at the same point every run.
Structural candidates, all independent of selection: SURBs already delivered that name the
dead first hop are unusable and single-use (§2.4); edgli keeps minting more for up to the
60 s path cache / 30 s refresh (§6.3); the exit then signals SURB distress `0x01` /
out-of-SURBs `0x03` (§2.4); and retransmissions can be silently dropped as duplicate
`ReplayTag`s (§2.2), which fits the ~4× packet amplification observed.

*Keep it as:* a total-collapse guard and behaviour record. Do not cite it as evidence for
any of the four PRs.

*Test:* `session_should_survive_return_relayer_loss`.

### S3 — Return relayer's channel closes · **not implemented — highest value next**

*Isolates:* #8329 `invalidate_relayer`, which is keyed on **channel close**, not on node
death. S2 kills the process, so the channel stays `OPEN` on chain and the invalidation
path never fires — S2 cannot test #8329 at all.

*Setup:* as S1, but instead of SIGKILL, close the exit→R channel from the exit's REST API
(`DELETE /api/v4/channels/{address}`). R stays alive, reachable and well-scored, so this
isolates the invalidation logic from transport death. Vary the **hoprd** pin.

*Signal:* R's forwarded delta drops to ~0 within one SURB-buffer drain while overall
arrival stays high. Without the fix, SURBs naming R keep being popped and fail: a
non-final edge needs an OPEN channel (§6.1), and `PENDING_TO_CLOSE`/`CLOSED` makes the
ticket unredeemable (§3.1), so those replies are lost rather than rerouted.

*Watch out:* closure is not instant — `PENDING_TO_CLOSE` holds for `T_closure` (§3.1).
Gate on the channel status the exit reports, not on a sleep.

### S4 — Stale SURB backlog drains before a path change takes effect · **not implemented**

*Isolates:* #8328 FIFO vs LIFO pop order — the "a return-path change only takes effect
after ~10 MB of stale backlog is consumed" half of the incident.

*Setup:* provision a large SURB buffer and let it fill (the session config already asks for
a production-scale 10 MB / `always_max_out_surbs`), quiesce the reply stream so the backlog
is genuinely stale, close a channel as in S3, then resume.

*Signal:* time (or bytes) from the change until replies first appear on the new path. FIFO
must drain the backlog first; LIFO uses the freshest SURB immediately. Vary the **hoprd**
pin; the metric is a latency-to-recovery, not a share.

### S5 — 0-hop return path must not be invalidated · **not implemented**

*Isolates:* #8329's false-positive guard. `chain_length() == 1` means the first relayer
*is* the final recipient, and the final hop needs no channel (§6.1) — so closing a channel
must **not** invalidate those SURBs.

*Setup:* 0-hop return path, close a channel from the exit, keep pumping.

*Signal:* replies continue uninterrupted. A regression here shows up as replies stopping
after an unrelated channel closes — silent and hard to attribute in production, which is
exactly why it is worth pinning.

## Results

Measured on this laptop, 5-node binary chain, 4 MiB pump. "pre-fix" = `hoprd` 4.0.3 +
`edgli` 3.5.0, both on `hopr-lib` `10f6d80c`; "fixed" = `hoprd` 4.1.0 (hoprd#123) +
`edgli` `06ab8d1f` (edge-client#143) on `hopr-lib` `4a47cdff`.

| Config             | histogram      | imbalance | after-kill arrival |
| ------------------ | -------------- | --------- | ------------------ |
| fixed, unshaped    | 25/25/25/25    | 1.03      | 54.86%, 55.06%     |
| pre-fix, unshaped  | 25/25/25/25    | 1.04      | 54.16%             |
| pre-fix, skewed¹   | 36/32/16/16    | 2.28      | —                  |
| pre-fix, skewed¹   | 49/24/17/11    | 4.63      | 54.81%             |
| **fixed, skewed¹** | **34/28/26/12**| **2.97**  | —                  |

¹ with the first latency profile (5/50/100/150/200 ms), which collides two pairs of nodes
into the same score step; the current profile separates all four. All five rows are
directly comparable — same profile, same cluster shape, same 4 MiB pump.

### What the numbers say

**The ~55% after-kill arrival is pre-existing** — identical on both stacks, and invariant
whether the killed relayer carried 25% or 49%. The PR stack introduces no regression, and
S2 attributes nothing.

**An unshaped cluster is blind to selection strategy.** Equal scores make weighted-random
and round-robin the same distribution. Any spread result taken without a latency profile
is meaningless.

**Under skew, the fixed stack does not spread as designed.** Its imbalance (2.97) falls
*between* the two pre-fix runs (2.28, 4.63) — no separation. The design predicts ≈1.0,
because with 4 candidates `K = min(min_return_path_diversity, buckets) = 4` should select
every bucket and then cycle.

The suspected mechanism is the call site (`transport/hopr/src/path/planner.rs`):

```rust
let num_possible_surbs = HoprPacket::max_surbs_with_message(size_hint).min(max_surbs);
self.resolve_diverse_return_paths(*destination, return_options, num_possible_surbs)
// …and inside: let wanted = self.min_return_path_diversity.min(count);
```

`count` is *how many SURBs fit in one packet*, so diversity is bounded per **packet**, not
across the SURB stream. Each call re-picks buckets by weighted sampling, independently of
previous calls, so however even the rotation is within one packet, the long-run
distribution across packets converges back to weight-proportional — the pre-fix behaviour.
Needs confirming against the planner's own unit tests; the integration measurement is
consistent with it and inconsistent with the intended effect.

**Cache expiry is the wrong recovery trigger.** The path cache is 60 s TTL / 30 s
background refresh (§6.3) with no invalidation on timeout or loss. After a relayer dies the
client keeps minting SURBs naming it — weight-proportionally, so a *well-scored* dead
relayer attracts *more* of them — and each is single-use (§2.4), so they are burned rather
than retried elsewhere. The exit then signals SURB distress `0x01` / out-of-SURBs `0x03`.
Recovery should be driven by observed timeouts/loss, not by a timer.

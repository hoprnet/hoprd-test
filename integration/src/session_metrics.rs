//! Per-session counters read from the entry's own process.
//!
//! The entry runs in-process (`edgli` linked into the test binary), so its Prometheus registry is
//! this process's registry and can be gathered directly — no HTTP, no node to scrape.
//!
//! # Why this exists
//!
//! The relayer histogram in [`crate::relayers`] reads `hopr_packets_count{type="forwarded"}`, which
//! is a **node-wide lifetime counter**: every packet that node relayed, for any session, plus
//! network-graph probes and keep-alives. It is sound for *relative share* — which relayer is
//! busiest, and how that redistributes after a kill — and that is all it is used for.
//!
//! It is not sound as an absolute packet count for one session, and reading it that way produced a
//! false finding: 33 196 forwarded packets against 127 KB of delivered payload, reported as a
//! two-orders-of-magnitude delivery gap when most of those packets were never this session's.
//!
//! These counters are labelled by `session_id`, so they answer the question the node-wide counter
//! cannot: how many packets actually reached *this* session.
//!
//! # Reading the result
//!
//! [`SessionCounters::packets_in`] against the payload the pump got back separates two failures
//! that both present as "throughput collapsed":
//!
//! | packets in | payload out | reading |
//! | ---------- | ----------- | ------- |
//! | ≈ 0 | ≈ 0 | nothing arrived — the exit never sent, look at its SURB balance |
//! | high | ≈ 0 | it arrived and did not come back out — look above the return path |
//!
//! # Observability is not assumed, twice over
//!
//! `mod telemetry` in `hopr-transport-session` is behind that crate's `telemetry` feature, which
//! the harness turns on via a direct `hopr-lib` dependency. With the feature off no family exists
//! at all, and reporting that as zero is indistinguishable from a session that received nothing —
//! precisely the conclusion under test.
//!
//! Enabling the feature is not sufficient either. The segment and frame families are driven by
//! `SessionTelemetryTracker`, which an unreliable session never installs, so they stay absent while
//! packets pour in. The first version of this module read exactly those and reported "segments in
//! 0, frames completed 0 / emitted 0 / discarded 0" for a phase carrying 12 466 packets.
//!
//! Hence: absence is `None` and prints as "absent", a real zero is `Some(0)`, and
//! [`SessionCounters::nonzero`] lists whatever moved so an unnamed live family cannot hide.

use std::collections::BTreeMap;

/// Every family this module knows how to read, plus a prefix sweep for the rest.
///
/// Prefix-swept rather than hand-listed because which families are *live* depends on the session
/// type, and that is not knowable from here. The first run of this module read the ack and frame
/// counters and got zero for all four while 12 466 packets were demonstrably arriving: those hooks
/// come from `SessionTelemetryTracker`, which an unreliable session does not drive. A hand-listed
/// reader reports that as "nothing arrived" — the same false answer, one layer deeper.
const SESSION_PREFIX: &str = "hopr_session_";

/// Packets received by the session, counted one per packet on the session's own receive stream.
///
/// Named for SURB accounting upstream (`session_rx.inspect(|_| record_session_surb_consumed(1))`,
/// "received packets always consume a single SURB"), but it is a packet-in counter and it is the
/// only one that is live for an unreliable session. This is *the* number for "how much actually
/// reached the entry", as opposed to how much payload came back out of reassembly.
const PACKETS_IN: &str = "hopr_session_surb_consumed_total";

/// SURBs minted by the entry for the counterparty to reply with.
const SURBS_PRODUCED: &str = "hopr_session_surb_produced_total";

/// Segment/frame accounting. Driven by `SessionTelemetryTracker`, which is **not** installed for
/// every session type — read these only alongside their presence flag, never as bare zeroes.
const SEGMENTS_IN: &str = "hopr_session_ack_incoming_segments_total";
const FRAMES_COMPLETED: &str = "hopr_session_frame_completed_total";
const FRAMES_EMITTED: &str = "hopr_session_frame_emitted_total";
const FRAMES_DISCARDED: &str = "hopr_session_frame_discarded_total";

/// One reading of the entry's per-session counters, summed over every live session.
///
/// Summed rather than per-`session_id` on purpose: a scenario runs one data session and the label
/// is an opaque id the test never learns. If a scenario ever runs two at once, this has to grow a
/// session filter — it would silently conflate them otherwise.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SessionCounters {
    /// Every `hopr_session_*` family found, summed over its `session_id` labels.
    ///
    /// A family that is *missing* from this map was never registered — the build lacks the feature,
    /// or nothing drives that code path for this session type. A family present with value zero
    /// genuinely counted nothing. Collapsing those two into a bare `0` is what makes an inactive
    /// counter read as a dead session.
    families: BTreeMap<String, u64>,
}

impl SessionCounters {
    /// The family's value, or `None` when it was never registered.
    pub fn get(&self, family: &str) -> Option<u64> {
        self.families.get(family).copied()
    }

    /// Packets received by the session. See [`PACKETS_IN`].
    pub fn packets_in(&self) -> Option<u64> {
        self.get(PACKETS_IN)
    }

    /// Whether any per-session family exists at all; `false` means the build has no telemetry.
    pub fn observable(&self) -> bool {
        !self.families.is_empty()
    }

    /// Counters accumulated between `self` (earlier) and `later`.
    ///
    /// Saturating: these are monotone counters, but a session that closes and drops its label set
    /// can make a later reading smaller, and an underflow there would print as a huge number.
    pub fn delta(&self, later: &Self) -> Self {
        Self {
            families: later
                .families
                .iter()
                .map(|(name, &v)| {
                    (
                        name.clone(),
                        v.saturating_sub(self.get(name).unwrap_or_default()),
                    )
                })
                .collect(),
        }
    }

    /// One line for the run log, or an explicit statement that nothing could be measured.
    ///
    /// Leads with packets in, because that is the number that separates "nothing reached us" from
    /// "it reached us and did not come back out". Families that were never registered are named as
    /// absent rather than printed as zero.
    pub fn summary(&self) -> String {
        if !self.observable() {
            return "per-session counters unavailable (built without the telemetry feature) — \
                    these are not zeroes"
                .to_string();
        }
        let show = |family: &str| match self.get(family) {
            Some(v) => v.to_string(),
            None => "absent".to_string(),
        };
        format!(
            "packets into the session {}, SURBs produced {}; segments in {}, frames completed {} / \
             emitted {} / discarded {}",
            show(PACKETS_IN),
            show(SURBS_PRODUCED),
            show(SEGMENTS_IN),
            show(FRAMES_COMPLETED),
            show(FRAMES_EMITTED),
            show(FRAMES_DISCARDED),
        )
    }

    /// Every family that actually moved, so a live counter this module does not name still shows up.
    ///
    /// Discovery, not decoration: which families are driven depends on the session type, and the
    /// alternative to printing them is guessing which ones to hard-code and silently missing the
    /// rest.
    pub fn nonzero(&self) -> String {
        let moved: Vec<String> = self
            .families
            .iter()
            .filter(|&(_, &v)| v > 0)
            .map(|(name, v)| format!("{name}={v}"))
            .collect();
        if moved.is_empty() {
            "no per-session family moved".to_string()
        } else {
            moved.join(" ")
        }
    }
}

/// Read the entry's per-session counters out of this process's own registry.
pub fn sample() -> SessionCounters {
    match edgli::hopr_lib::collect_hopr_metrics() {
        Ok(text) => parse(&text),
        Err(e) => {
            tracing::warn!("could not gather in-process metrics: {e}");
            SessionCounters::default()
        }
    }
}

/// Sum every `hopr_session_*` family over its `session_id` labels.
fn parse(body: &str) -> SessionCounters {
    let mut families: BTreeMap<String, u64> = BTreeMap::new();

    for line in body.lines().filter(|l| !l.starts_with('#')) {
        // The family name ends at the label brace or the value separator. Matching on a prefix
        // alone would fold `..._total_bytes` into `..._total`.
        let Some(name) = line.split(['{', ' ']).next() else {
            continue;
        };
        if !name.starts_with(SESSION_PREFIX) {
            continue;
        }
        // Registered but unset series still create the family, which is the distinction between
        // "counted nothing" and "never existed" — so insert before parsing the value.
        let entry = families.entry(name.to_string()).or_default();
        // Counters render as floats in the text format ("42" or "42.0").
        if let Some((_, value)) = line.rsplit_once(' ')
            && let Ok(v) = value.trim().parse::<f64>()
            && v.is_finite()
            && v >= 0.0
        {
            *entry += v as u64;
        }
    }

    SessionCounters { families }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXPOSITION: &str = r#"
# HELP hopr_session_ack_incoming_segments_total Incoming session segments
# TYPE hopr_session_ack_incoming_segments_total counter
hopr_session_ack_incoming_segments_total{session_id="a"} 1200
hopr_session_ack_incoming_segments_total{session_id="b"} 34
hopr_session_frame_completed_total{session_id="a"} 900
hopr_session_frame_emitted_total{session_id="a"} 880
hopr_session_frame_discarded_total{session_id="a"} 20
hopr_session_surb_produced_total{session_id="a"} 500
hopr_session_surb_consumed_total{session_id="a"} 480.0
hopr_packets_count{type="forwarded"} 99999
"#;

    fn with(pairs: &[(&str, u64)]) -> SessionCounters {
        SessionCounters {
            families: pairs.iter().map(|(n, v)| ((*n).to_string(), *v)).collect(),
        }
    }

    #[test]
    fn every_session_label_should_be_summed_into_one_reading() {
        let c = parse(EXPOSITION);
        assert!(c.observable());
        assert_eq!(c.get(SEGMENTS_IN), Some(1234), "both session labels count");
        assert_eq!(c.get(FRAMES_COMPLETED), Some(900));
        assert_eq!(c.get(FRAMES_DISCARDED), Some(20));
        assert_eq!(c.get(SURBS_PRODUCED), Some(500));
        assert_eq!(c.packets_in(), Some(480), "float-rendered counters parse");
    }

    /// The node-wide counter that produced the original false finding must not leak in.
    #[test]
    fn an_unrelated_metric_family_should_not_be_counted() {
        let c = parse("hopr_packets_count{type=\"forwarded\"} 33196\n");
        assert!(
            !c.observable(),
            "a body with none of our families is not observable"
        );
    }

    /// A family whose name merely starts with another's would otherwise be folded into it.
    #[test]
    fn a_longer_family_name_sharing_a_prefix_should_stay_separate() {
        let c = parse(
            "hopr_session_frame_discarded_total{session_id=\"a\"} 5\n\
             hopr_session_frame_discarded_total_bytes{session_id=\"a\"} 77\n",
        );
        assert_eq!(c.get(FRAMES_DISCARDED), Some(5));
        assert_eq!(c.get("hopr_session_frame_discarded_total_bytes"), Some(77));
    }

    /// The failure this module was rewritten for. The ack and frame counters are driven by
    /// `SessionTelemetryTracker`, which an unreliable session never installs, so they are absent
    /// while packets are demonstrably arriving. Printing them as `0` said "nothing reached the
    /// session" — the exact conclusion under test — in a run where 12 466 packets had.
    #[test]
    fn a_family_that_was_never_registered_should_read_as_absent_not_zero() {
        let live_but_untracked = parse(&format!("{PACKETS_IN}{{session_id=\"a\"}} 12466\n"));
        assert_eq!(live_but_untracked.packets_in(), Some(12466));
        assert_eq!(
            live_but_untracked.get(SEGMENTS_IN),
            None,
            "an untracked family must not materialise as zero"
        );
        assert!(
            live_but_untracked.summary().contains("segments in absent"),
            "the log line must name it absent, got: {}",
            live_but_untracked.summary()
        );
    }

    /// A registered family that genuinely counted nothing is a different statement from an absent
    /// one, and has to survive the round trip as `Some(0)`.
    #[test]
    fn a_registered_family_at_zero_should_stay_distinguishable_from_an_absent_one() {
        let c = parse(&format!("{FRAMES_DISCARDED}{{session_id=\"a\"}} 0\n"));
        assert_eq!(c.get(FRAMES_DISCARDED), Some(0));
        assert_eq!(c.get(FRAMES_COMPLETED), None);
    }

    /// Without the telemetry feature nothing is registered at all. Reporting that as zero would
    /// read as "the session received nothing".
    #[test]
    fn absent_metrics_should_be_reported_as_unmeasurable_rather_than_zero() {
        let c = parse("");
        assert!(!c.observable());
        assert!(
            c.summary().contains("not zeroes"),
            "the log line must say the counters were unavailable, got: {}",
            c.summary()
        );
    }

    #[test]
    fn a_delta_should_not_underflow_when_a_session_drops_its_labels() {
        let before = with(&[(PACKETS_IN, 1000)]);
        let after = with(&[(PACKETS_IN, 10)]);
        assert_eq!(before.delta(&after).packets_in(), Some(0));
    }

    /// Discovery: a live family this module does not name still has to surface, or the next
    /// session type quietly measures nothing again.
    #[test]
    fn an_unnamed_family_that_moved_should_still_be_reported() {
        let before = with(&[("hopr_session_something_new_total", 5)]);
        let after = with(&[("hopr_session_something_new_total", 42)]);
        assert_eq!(
            before.delta(&after).nonzero(),
            "hopr_session_something_new_total=37"
        );
    }
}

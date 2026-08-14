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
//! cannot: how many segments actually reached *this* session, and what happened to them.
//!
//! # Reading the result
//!
//! The three numbers separate three different failures that all look like "throughput collapsed":
//!
//! | segments in | frames discarded | reading |
//! | ----------- | ---------------- | ------- |
//! | ≈ what was sent | high | packets arrive, frames never complete — loss is in reassembly |
//! | ≈ 0 | ≈ 0 | nothing arrived — the exit never sent, look at its SURB balance |
//! | ≈ what was sent | ≈ 0 | delivered; the shortfall is downstream of the session |
//!
//! # Observability is not assumed
//!
//! `mod telemetry` in `hopr-transport-session` is behind that crate's `telemetry` feature, which
//! the harness turns on via a direct `hopr-lib` dependency. With the feature off the metric
//! families do not exist, and a parser would report zero for every one of them — identical to a
//! session that received nothing, which is precisely the conclusion under test. So absence is
//! tracked explicitly as [`SessionCounters::observable`] rather than folded into a zero.

use std::collections::HashMap;

/// Metric families read per session. Extend deliberately: every one of these has to be
/// interpretable on its own, or it becomes another number nobody can act on.
const SEGMENTS_IN: &str = "hopr_session_ack_incoming_segments_total";
const FRAMES_COMPLETED: &str = "hopr_session_frame_completed_total";
const FRAMES_EMITTED: &str = "hopr_session_frame_emitted_total";
const FRAMES_DISCARDED: &str = "hopr_session_frame_discarded_total";
const SURBS_PRODUCED: &str = "hopr_session_surb_produced_total";
const SURBS_CONSUMED: &str = "hopr_session_surb_consumed_total";

/// One reading of the entry's per-session counters, summed over every live session.
///
/// Summed rather than per-`session_id` on purpose: a scenario runs one data session and the label
/// is an opaque id the test never learns. If a scenario ever runs two at once, this has to grow a
/// session filter — it would silently conflate them otherwise.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SessionCounters {
    /// Whether the metric families were present at all. `false` means the build lacks the
    /// `telemetry` feature and every count below is meaningless, not zero.
    pub observable: bool,
    pub segments_in: u64,
    pub frames_completed: u64,
    pub frames_emitted: u64,
    pub frames_discarded: u64,
    pub surbs_produced: u64,
    pub surbs_consumed: u64,
}

impl SessionCounters {
    /// Counters accumulated between `self` (earlier) and `later`.
    ///
    /// Saturating: these are monotone counters, but a session that closes and drops its label set
    /// can make a later reading smaller, and an underflow there would print as a huge number.
    pub fn delta(&self, later: &Self) -> Self {
        Self {
            observable: self.observable && later.observable,
            segments_in: later.segments_in.saturating_sub(self.segments_in),
            frames_completed: later.frames_completed.saturating_sub(self.frames_completed),
            frames_emitted: later.frames_emitted.saturating_sub(self.frames_emitted),
            frames_discarded: later.frames_discarded.saturating_sub(self.frames_discarded),
            surbs_produced: later.surbs_produced.saturating_sub(self.surbs_produced),
            surbs_consumed: later.surbs_consumed.saturating_sub(self.surbs_consumed),
        }
    }

    /// One line for the run log, or an explicit statement that nothing could be measured.
    pub fn summary(&self) -> String {
        if !self.observable {
            return "per-session counters unavailable (built without the telemetry feature) — \
                    these are not zeroes"
                .to_string();
        }
        format!(
            "segments in {}, frames completed {} / emitted {} / discarded {}, SURBs produced {} / \
             consumed {}",
            self.segments_in,
            self.frames_completed,
            self.frames_emitted,
            self.frames_discarded,
            self.surbs_produced,
            self.surbs_consumed,
        )
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

/// Sum each family over every `session_id` in a Prometheus text exposition.
fn parse(body: &str) -> SessionCounters {
    let mut sums: HashMap<&str, u64> = HashMap::new();
    let mut seen_any = false;

    for line in body.lines().filter(|l| !l.starts_with('#')) {
        // The family name ends at the label brace; matching on the prefix alone would let
        // `..._total_something` fall into the wrong bucket.
        let Some(name) = line.split(['{', ' ']).next() else {
            continue;
        };
        for family in [
            SEGMENTS_IN,
            FRAMES_COMPLETED,
            FRAMES_EMITTED,
            FRAMES_DISCARDED,
            SURBS_PRODUCED,
            SURBS_CONSUMED,
        ] {
            if name != family {
                continue;
            }
            seen_any = true;
            // Counters render as floats in the text format ("42" or "42.0").
            if let Some((_, value)) = line.rsplit_once(' ')
                && let Ok(v) = value.trim().parse::<f64>()
            {
                *sums.entry(family).or_default() += v as u64;
            }
        }
    }

    SessionCounters {
        observable: seen_any,
        segments_in: sums.get(SEGMENTS_IN).copied().unwrap_or_default(),
        frames_completed: sums.get(FRAMES_COMPLETED).copied().unwrap_or_default(),
        frames_emitted: sums.get(FRAMES_EMITTED).copied().unwrap_or_default(),
        frames_discarded: sums.get(FRAMES_DISCARDED).copied().unwrap_or_default(),
        surbs_produced: sums.get(SURBS_PRODUCED).copied().unwrap_or_default(),
        surbs_consumed: sums.get(SURBS_CONSUMED).copied().unwrap_or_default(),
    }
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

    #[test]
    fn every_session_label_should_be_summed_into_one_reading() {
        let c = parse(EXPOSITION);
        assert!(c.observable);
        assert_eq!(c.segments_in, 1234, "both session labels count");
        assert_eq!(c.frames_completed, 900);
        assert_eq!(c.frames_emitted, 880);
        assert_eq!(c.frames_discarded, 20);
        assert_eq!(c.surbs_produced, 500);
        assert_eq!(c.surbs_consumed, 480, "float-rendered counters parse");
    }

    /// The node-wide counter that produced the false finding must not leak into these.
    #[test]
    fn an_unrelated_metric_family_should_not_be_counted() {
        let c = parse("hopr_packets_count{type=\"forwarded\"} 33196\n");
        assert!(
            !c.observable,
            "a body with none of our families is not observable"
        );
        assert_eq!(c.segments_in, 0);
    }

    /// A family whose name merely starts with ours would otherwise be added to it.
    #[test]
    fn a_longer_family_name_sharing_our_prefix_should_not_be_counted() {
        let c = parse("hopr_session_frame_discarded_total_bytes{session_id=\"a\"} 77\n");
        assert!(!c.observable);
        assert_eq!(c.frames_discarded, 0);
    }

    /// Without the telemetry feature the families are absent. Reporting that as zero would read as
    /// "the session received nothing" — the exact conclusion the counters exist to test.
    #[test]
    fn absent_metrics_should_be_reported_as_unmeasurable_rather_than_zero() {
        let c = parse("");
        assert!(!c.observable);
        assert!(
            c.summary().contains("not zeroes"),
            "the log line must say the counters were unavailable, got: {}",
            c.summary()
        );
    }

    #[test]
    fn a_delta_should_not_underflow_when_a_session_drops_its_labels() {
        let before = SessionCounters {
            observable: true,
            segments_in: 1000,
            ..Default::default()
        };
        let after = SessionCounters {
            observable: true,
            segments_in: 10,
            ..Default::default()
        };
        assert_eq!(before.delta(&after).segments_in, 0);
    }
}

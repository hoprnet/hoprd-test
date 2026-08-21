//! PIX accounting for the edgli entry: dimensions, funding, and the counters both ends expose.
//!
//! PIX pays the Exit for the traffic it delivers. The Entry deposits wxHOPR to a per-Session
//! stealth address; the Exit reconstructs that address's key from the SSA shares carried by the
//! return-path SURBs it spent, and sweeps the deposit into its Safe. Everything here is the Entry
//! half plus whatever is needed to *observe* the Exit half from outside.
//!
//! # The two sides use different accounts
//!
//! Easy to get backwards, and the whole balance assertion rests on it.
//! `SafePayloadGenerator::transfer` builds a **direct** `HoprToken.transfer` signed by the node key
//! — the one call it does not route through the Safe module — so the Entry's deposits leave its
//! *node* account. The Exit's `sweep_recovered` calls `withdraw_from_signer(.., &safe_address)`, so
//! its recoveries land in its *Safe*.
//!
//! That asymmetry is also why [`fund_node_eoa`] exists at all: see its docs.
//!
//! # Dimensions have to match the Exit's window
//!
//! The Exit rejects any Session whose announced quota falls outside its `quota_range`, and edgli
//! derives that quota from its own `protocol.pix` (`Edgli::pix_ssa_quota`) rather than accepting
//! one from the caller. So the two have to be sized together: `dimensions` here against
//! `hoprd-localcluster --enable-pix`, which widens the window to 1 MiB. edgli's own defaults price
//! a ~560 MB quota and would be refused outright.

use crate::{Address, HoprBalance, cluster::NodeInfo};
use anyhow::Context as _;

// ── Dimensions and pricing ───────────────────────────────────────────────────

/// Polynomials per SSA, at the protocol floor (`PixGlobalConfig` validates `>= 8`).
pub const PIX_POLYS: usize = 8;
/// Shares needed to reconstruct one polynomial, at the floor (validated `>= 2`).
pub const PIX_SHARES: usize = 2;
/// Shares emitted beyond the threshold.
///
/// Stated rather than left unset. Unset derives a surplus sized to absorb 20 % share loss, which is
/// the right production default but makes the quota a function of a formula this test would then
/// have to re-derive to price a deposit. It is also billed like any other emitted share — a
/// polynomial leaves the generator's queue having emitted `PIX_SHARES + PIX_ADDITIONAL_SHARES`
/// whether or not one was lost — so it costs both wxHOPR and wall-clock, hence the small value.
pub const PIX_ADDITIONAL_SHARES: usize = 2;

/// Charged per byte of the agreed quota. One deposit is `PRICE_PER_BYTE × quota_per_ssa`.
///
/// With the dimensions above the quota is `8 × (2 + 2) × 1038` ≈ 33.2 kB, so a deposit is
/// ~3.32 wxHOPR — unambiguous in a balance delta without being large.
pub const PRICE_PER_BYTE: &str = "0.0001 wxHOPR";

/// Ceiling on a single deposit. Must exceed `PRICE_PER_BYTE × quota` or the strategy refuses to
/// deposit at all and the Exit's kill switch closes the Session.
pub const MAX_SSA_ALLOCATION: &str = "10 wxHOPR";

/// How long the entry's pool keeps polling a stealth address for its deposit.
///
/// Also fixes the poll cadence at a tenth of this, which must stay comfortably below the Exit's
/// `max_deposit_wait + max_ssa_delivery_time` fuse (80 s under `--enable-pix`). The upstream
/// default of 60 s would poll every 6 s, which is fine; edgli's own default is what this guards
/// against drifting.
pub const MAX_DEPOSIT_TRACKING_TIME: std::time::Duration = std::time::Duration::from_secs(30);

/// The generator dimensions this test runs with, as edgli's `protocol.pix`.
///
/// `additional_shares` is `Some` deliberately — see [`PIX_ADDITIONAL_SHARES`].
#[cfg(feature = "pix")]
pub fn dimensions() -> edgli::PixGlobalConfig {
    edgli::PixGlobalConfig {
        num_ssa_parts: PIX_POLYS,
        ssa_part_size: PIX_SHARES,
        additional_shares: Some(PIX_ADDITIONAL_SHARES),
        ..Default::default()
    }
}

/// The entry-side settlement configuration matching [`dimensions`].
#[cfg(feature = "pix")]
pub fn entry_config() -> anyhow::Result<edgli::PixEntryConfig> {
    Ok(edgli::PixEntryConfig {
        strategy: edgli::PixEntryStrategy {
            price_per_byte: PRICE_PER_BYTE.parse().context("PRICE_PER_BYTE")?,
            max_ssa_allocation: MAX_SSA_ALLOCATION.parse().context("MAX_SSA_ALLOCATION")?,
            ..Default::default()
        },
        pool: edgli::PixEntryPool {
            max_deposit_tracking_time: MAX_DEPOSIT_TRACKING_TIME,
            ..Default::default()
        },
    })
}

/// Bytes of Exit → Entry traffic one deposit buys, for [`dimensions`].
///
/// Delegates to edgli rather than recomputing `polys × shares × PAYLOAD_SIZE` here. The Exit
/// derives the price it expects from the *announced* `PixParams`, so a second implementation of
/// the same product is a second thing that can disagree with it.
#[cfg(feature = "pix")]
pub fn quota_per_ssa() -> anyhow::Result<u64> {
    let cfg = edgli::hopr_lib::config::HoprLibConfig {
        protocol: edgli::hopr_lib::exports::transport::HoprProtocolConfig {
            pix: dimensions(),
            ..Default::default()
        },
        ..Default::default()
    };
    Ok(edgli::quota_per_ssa(&edgli::pix_ssa_quota(&cfg)?))
}

/// wxHOPR one completed SSA cycle costs the entry.
#[cfg(feature = "pix")]
pub fn per_cycle() -> anyhow::Result<HoprBalance> {
    let price: HoprBalance = PRICE_PER_BYTE.parse().context("PRICE_PER_BYTE")?;
    Ok(price * quota_per_ssa()?)
}

// ── Funding the entry's own account ──────────────────────────────────────────

/// Anvil's first account, which `blokli-contract-deployer` deploys `HoprToken` from and which
/// therefore holds the supply. The same well-known constant `hoprd-localcluster` uses as its
/// deployer (`localcluster/src/identity.rs`), and the chain `scripts/integration/chain-up.sh`
/// starts is plain anvil with its default accounts.
const ANVIL_DEPLOYER_KEY: &str = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/// Leave `amount` wxHOPR on `target`'s own account.
///
/// # Why the test has to do this
///
/// edgli boots on a localcluster *extra identity*, and `deploy_safe` sweeps that identity's whole
/// wxHOPR balance into its Safe during provisioning. `hoprd-localcluster` re-funds the node
/// accounts afterwards when PIX is on (its `node_deposit_float`), but the extras loop has no
/// equivalent — so edgli starts with a funded Safe and an empty account, and PIX deposits come off
/// the account.
///
/// It cannot pay itself out of its own Safe either: a Safe-routed wxHOPR transfer is exactly the
/// primitive that does not exist upstream, which is why deposits bypass the module in the first
/// place. So the float has to arrive from outside, and the deployer is the only account on this
/// chain that has any.
///
/// Doing it here rather than fixing the localcluster gap also makes the float a *test* constant,
/// which the exhaustion scenario needs: it funds an exact number of cycles and asserts what
/// happens on the next one.
pub async fn fund_node_eoa(
    blokli_url: &str,
    target: Address,
    amount: HoprBalance,
) -> anyhow::Result<()> {
    use edgli::hopr_lib::api::types::crypto::keypairs::Keypair as _;

    let secret = hex::decode(ANVIL_DEPLOYER_KEY).context("decoding the anvil deployer key")?;
    let deployer = edgli::ChainKeypair::from_secret(&secret)
        .map_err(|e| anyhow::anyhow!("anvil deployer keypair: {e}"))?;

    // The same connector budget the node itself runs with. At the default this submits the
    // transfer, waits for a confirmation blokli has not indexed yet, and reports "operation timed
    // out at the client" — for a transaction that was in fact mined.
    let ops = edgli::make_incentive_operations(
        edgli::BlokliEndpoint::from_optional_url(Some(blokli_url))?,
        &deployer,
        Some(crate::env::connector_cfg()),
    )
    .await
    .context("connecting to blokli as the deployer")?;

    // Named `safe_address` upstream because on-boarding only ever sends to a Safe, but it is the
    // recipient of a plain `HoprToken.transfer` — an ordinary account is a valid destination.
    ops.withdraw_wxhopr(target, amount)
        .await
        .with_context(|| format!("transferring {amount} to {target}"))?;

    tracing::info!(%target, %amount, "funded the entry's own account for PIX deposits");
    Ok(())
}

// ── Reconciling balances ─────────────────────────────────────────────────────

/// Ceiling when reading a balance delta as a whole number of cycles; a bound on the division
/// rather than an expectation.
pub const MAX_PLAUSIBLE_CYCLES: u64 = 100_000;

/// Whole SSA deposits represented by `delta`, or `None` when it is not an exact multiple.
///
/// The exactness *is* the assertion. With auto-redeeming off, PIX sweeps are the only thing that
/// credits the Exit's Safe in wxHOPR, so a whole multiple of `price_per_byte × quota` says every
/// wxHOPR that arrived did so as a complete SSA deposit — which is the statement that recovered
/// funds correspond to delivered quota. A non-multiple means something else moved the balance and
/// the count would be meaningless.
///
/// Ported from `hoprd/localcluster/tests/common/pix.rs` so both harnesses read a delta the same
/// way; the two once had divergent implementations that disagreed on what a whole cycle was.
pub fn completed_cycles(delta: HoprBalance, per_cycle: HoprBalance) -> Option<u64> {
    if per_cycle.is_zero() {
        return None;
    }
    let n = delta.amount() / per_cycle.amount();
    if n > MAX_PLAUSIBLE_CYCLES.into() {
        return None;
    }
    let n = n.as_u64();
    (per_cycle * n == delta).then_some(n)
}

/// wxHOPR held by a cluster node's own account and by its Safe.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NodeBalances {
    /// The node's own account. An Exit's does not move under PIX; an Entry pays deposits from it.
    pub node: HoprBalance,
    /// The Safe. Swept PIX deposits land here.
    pub safe: HoprBalance,
}

/// Read one cluster node's wxHOPR balances over its REST API.
pub async fn node_balances(node: &NodeInfo) -> anyhow::Result<NodeBalances> {
    let mut req = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?
        .get(format!("{}/api/v4/account/balances", node.api_url));
    if let Some(token) = node.api_token.as_ref() {
        req = req.header("Authorization", format!("Bearer {token}"));
    }
    let response = req.send().await.context("GET /account/balances")?;
    anyhow::ensure!(
        response.status().is_success(),
        "/account/balances returned {}",
        response.status()
    );
    parse_balances(&response.text().await.context("reading the balances body")?)
}

/// Both wxHOPR figures out of an `AccountBalancesResponse` body.
///
/// The amounts are display strings ("1000 wxHOPR"), not numbers, so they are parsed rather than
/// read as JSON numerics.
fn parse_balances(body: &str) -> anyhow::Result<NodeBalances> {
    let json: serde_json::Value = serde_json::from_str(body).context("parsing balances JSON")?;
    let field = |name: &str| -> anyhow::Result<HoprBalance> {
        json[name]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("balances response has no string field `{name}`"))?
            .parse()
            .with_context(|| format!("unparseable wxHOPR balance in `{name}`"))
    };
    Ok(NodeBalances {
        node: field("hopr")?,
        safe: field("safeHopr")?,
    })
}

// ── PIX lifecycle counters ───────────────────────────────────────────────────

/// Deposits the Exit confirmed, so its kill switch stood down for that SSA.
const DEPOSIT_TRACKING: &str = "hopr_strategy_pix_deposit_tracking_total";
/// Stealth-address keys the Exit reconstructed from the shares it received.
const KEYS_RECOVERED: &str = "hopr_strategy_pix_keys_recovered_total";
/// Recovered deposits the Exit moved into its Safe.
const SWEEPS: &str = "hopr_strategy_pix_sweeps_total";
/// Deposits the entry made.
const DEPOSITS: &str = "hopr_strategy_pix_deposits_total";
/// Deposits the entry could not make — an empty account shows up here.
const DEPOSITS_FAILED: &str = "hopr_strategy_pix_deposits_failed_total";
/// Deposits the entry refused to make, the computed amount being over `max_ssa_allocation`.
const DEPOSITS_REJECTED: &str = "hopr_strategy_pix_deposits_rejected_total";

/// One reading of the `hopr_strategy_pix_*` family.
///
/// Absent and zero are kept distinct throughout, for the reason [`crate::session_metrics`]
/// documents at length: these counters live behind `hopr-strategy/telemetry`, and with the feature
/// off nothing is registered at all. Reporting that as `0` says "the Exit never confirmed a
/// deposit" — which is the exact conclusion under test — when the truth is that nothing looked.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PixCounters {
    families: std::collections::BTreeMap<String, u64>,
}

impl PixCounters {
    /// The family's value, or `None` when it was never registered.
    pub fn get(&self, family: &str) -> Option<u64> {
        self.families.get(family).copied()
    }

    /// A `deposit_tracking` outcome: `"confirmed"` or `"timeout"`.
    ///
    /// Absent means something different here than for the unlabelled families. A label set on a
    /// `MultiCounter` materialises only when it is first incremented, so a run in which no deposit
    /// timed out has no `{result="timeout"}` series at all — `None` is "it never happened", not
    /// "nothing was measuring". Read this with `unwrap_or(0)` once [`Self::observable`] has ruled
    /// out the missing-telemetry case; demanding `Some(0)` fails every healthy run.
    pub fn deposit_tracking(&self, result: &str) -> Option<u64> {
        self.get(&format!("{DEPOSIT_TRACKING}/{result}"))
    }

    /// Deposits the Exit confirmed in time.
    pub fn deposits_confirmed(&self) -> Option<u64> {
        self.deposit_tracking("confirmed")
    }

    /// Deposits the Exit gave up waiting for; each one armed the kill switch.
    pub fn deposits_timed_out(&self) -> Option<u64> {
        self.deposit_tracking("timeout")
    }

    pub fn keys_recovered(&self) -> Option<u64> {
        self.get(KEYS_RECOVERED)
    }

    pub fn sweeps(&self) -> Option<u64> {
        self.get(SWEEPS)
    }

    pub fn deposits(&self) -> Option<u64> {
        self.get(DEPOSITS)
    }

    pub fn deposits_failed(&self) -> Option<u64> {
        self.get(DEPOSITS_FAILED)
    }

    pub fn deposits_rejected(&self) -> Option<u64> {
        self.get(DEPOSITS_REJECTED)
    }

    /// Whether any PIX family exists at all; `false` means the build has no strategy telemetry.
    pub fn observable(&self) -> bool {
        !self.families.is_empty()
    }

    /// Counters accumulated between `self` (earlier) and `later`.
    ///
    /// Saturating, so a family that disappeared between readings reads as zero rather than
    /// underflowing into a very large number.
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

    /// One line for the run log, naming unregistered families as absent rather than printing zero.
    pub fn summary(&self) -> String {
        if !self.observable() {
            return "PIX counters unavailable (built without hopr-strategy/telemetry) — these are \
                    not zeroes"
                .to_string();
        }
        let show = |family: &str, value: Option<u64>| match value {
            Some(v) => format!("{family}={v}"),
            None => format!("{family}=absent"),
        };
        [
            show("deposits", self.deposits()),
            show("failed", self.deposits_failed()),
            show("rejected", self.deposits_rejected()),
            show("confirmed", self.deposits_confirmed()),
            show("timeout", self.deposits_timed_out()),
            show("recovered", self.keys_recovered()),
            show("sweeps", self.sweeps()),
        ]
        .join(" ")
    }
}

/// The Exit's PIX counters, scraped from its `/metrics`.
///
/// hoprd strips every `hopr_session_*` series from that endpoint for cardinality reasons, but the
/// `hopr_strategy_pix_*` ones are node-wide and survive.
pub async fn sample_exit(node: &NodeInfo) -> anyhow::Result<PixCounters> {
    Ok(parse(&crate::cluster::scrape_metrics(node).await?))
}

/// The entry's own PIX counters, out of this process's registry.
///
/// No HTTP and no node: edgli is linked into the test binary, so its registry is this one.
pub fn sample_entry() -> PixCounters {
    match edgli::hopr_lib::collect_hopr_metrics() {
        Ok(text) => parse(&text),
        Err(e) => {
            tracing::warn!("could not gather in-process metrics: {e}");
            PixCounters::default()
        }
    }
}

/// Read every `hopr_strategy_pix_*` sample out of a Prometheus text exposition.
///
/// Labelled series are keyed `<family>/<label value>` so `deposit_tracking{result="confirmed"}` and
/// `{result="timeout"}` stay apart — they mean opposite things, and summing them would report a
/// Session whose every deposit timed out as one whose every deposit landed.
fn parse(body: &str) -> PixCounters {
    const PREFIX: &str = "hopr_strategy_pix_";
    let mut families: std::collections::BTreeMap<String, u64> = std::collections::BTreeMap::new();

    for line in body.lines().filter(|l| !l.starts_with('#')) {
        // The family name ends at the label brace or the value separator; matching on the prefix
        // alone would fold `_total_bytes` into `_total`.
        let Some(name) = line.split(['{', ' ']).next() else {
            continue;
        };
        if !name.starts_with(PREFIX) {
            continue;
        }
        let key = match line.split_once('{') {
            Some((_, rest)) => match rest.split_once('"').and_then(|(_, r)| r.split_once('"')) {
                Some((label, _)) => format!("{name}/{label}"),
                None => name.to_string(),
            },
            None => name.to_string(),
        };
        // Registered-but-unset series still create the family, which is the whole absent-vs-zero
        // distinction — so insert before parsing the value.
        let entry = families.entry(key).or_default();
        if let Some((_, value)) = line.rsplit_once(' ')
            && let Ok(v) = value.trim().parse::<f64>()
            && v.is_finite()
            && v >= 0.0
        {
            *entry += v as u64;
        }
    }

    PixCounters { families }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXPOSITION: &str = r#"
# HELP hopr_strategy_pix_deposits_total Deposits made
# TYPE hopr_strategy_pix_deposits_total counter
hopr_strategy_pix_deposits_total 7
hopr_strategy_pix_deposits_failed_total 0
hopr_strategy_pix_deposit_tracking_total{result="confirmed"} 5
hopr_strategy_pix_deposit_tracking_total{result="timeout"} 2
hopr_strategy_pix_keys_recovered_total 5
hopr_strategy_pix_sweeps_total 4.0
hopr_packets_count{type="forwarded"} 99999
"#;

    fn hopr(amount: &str) -> HoprBalance {
        amount.parse().expect("valid static amount")
    }

    #[test]
    fn every_pix_family_should_be_read_including_labelled_ones() {
        let c = parse(EXPOSITION);
        assert!(c.observable());
        assert_eq!(c.deposits(), Some(7));
        assert_eq!(c.keys_recovered(), Some(5));
        assert_eq!(c.sweeps(), Some(4), "float-rendered counters parse");
    }

    /// The two tracking outcomes mean opposite things. Summed, a Session whose every deposit timed
    /// out reads exactly like one whose every deposit landed.
    #[test]
    fn the_two_deposit_tracking_outcomes_should_stay_separate() {
        let c = parse(EXPOSITION);
        assert_eq!(c.deposits_confirmed(), Some(5));
        assert_eq!(c.deposits_timed_out(), Some(2));
    }

    /// A healthy run has no `{result="timeout"}` series at all, because a `MultiCounter` label set
    /// materialises only on first increment. An assertion demanding `Some(0)` there fails every
    /// passing run — which is how the first end-to-end run of `tests/pix.rs` failed, after the
    /// protocol had in fact completed six full cycles.
    #[test]
    fn an_outcome_that_never_occurred_should_read_as_absent_not_zero() {
        let healthy = parse(&format!("{DEPOSIT_TRACKING}{{result=\"confirmed\"}} 7\n"));
        assert_eq!(healthy.deposits_confirmed(), Some(7));
        assert_eq!(healthy.deposits_timed_out(), None);
        assert!(
            healthy.observable(),
            "the family exists, so the build does have telemetry — only that one label is unused"
        );
    }

    /// A registered family at zero is a different statement from an absent one: the first says the
    /// entry made no failed deposit, the second says nothing was measuring.
    #[test]
    fn a_registered_zero_should_stay_distinguishable_from_an_absent_family() {
        let c = parse(EXPOSITION);
        assert_eq!(c.deposits_failed(), Some(0));
        assert_eq!(c.deposits_rejected(), None);
        assert!(
            c.summary().contains("rejected=absent"),
            "the log line must name it absent, got: {}",
            c.summary()
        );
    }

    /// Without `hopr-strategy/telemetry` nothing is registered. Reporting that as zero would read
    /// as "the entry never deposited", which is the conclusion under test.
    #[test]
    fn absent_counters_should_be_reported_as_unmeasurable_rather_than_zero() {
        let c = parse("hopr_packets_count{type=\"forwarded\"} 33196\n");
        assert!(!c.observable());
        assert!(c.summary().contains("not zeroes"), "got: {}", c.summary());
    }

    /// A longer family name sharing this one's prefix must not be folded into it, or a frozen
    /// counter reads as still moving.
    #[test]
    fn a_longer_family_sharing_a_prefix_should_stay_separate() {
        let c = parse(
            "hopr_strategy_pix_sweeps_total 5\n\
             hopr_strategy_pix_sweeps_total_bytes 77\n",
        );
        assert_eq!(c.sweeps(), Some(5));
        assert_eq!(c.get("hopr_strategy_pix_sweeps_total_bytes"), Some(77));
    }

    #[test]
    fn a_delta_should_not_underflow_when_a_family_disappears() {
        let before = parse("hopr_strategy_pix_deposits_total 100\n");
        let after = parse("hopr_strategy_pix_deposits_total 3\n");
        assert_eq!(before.delta(&after).deposits(), Some(0));
    }

    #[test]
    fn a_whole_number_of_cycles_should_be_recovered_from_an_exact_delta() {
        assert_eq!(
            completed_cycles(hopr("9.96 wxHOPR"), hopr("3.32 wxHOPR")),
            Some(3)
        );
        assert_eq!(
            completed_cycles(hopr("0 wxHOPR"), hopr("3.32 wxHOPR")),
            Some(0)
        );
    }

    /// A delta that is not a whole multiple means something other than PIX sweeps moved the
    /// balance, and any cycle count read off it would be fiction.
    #[test]
    fn a_delta_that_is_not_a_whole_multiple_should_not_yield_a_count() {
        assert_eq!(
            completed_cycles(hopr("5 wxHOPR"), hopr("3.32 wxHOPR")),
            None
        );
    }

    #[test]
    fn a_zero_per_cycle_price_should_not_divide() {
        assert_eq!(completed_cycles(hopr("5 wxHOPR"), hopr("0 wxHOPR")), None);
    }

    #[test]
    fn balances_should_be_parsed_from_display_strings() -> anyhow::Result<()> {
        let body = r#"{"hopr":"12.5 wxHOPR","native":"1 xDai","safeHopr":"1000 wxHOPR",
                       "safeHoprAllowance":"10000 wxHOPR","safeNative":"1 xDai"}"#;
        let b = parse_balances(body)?;
        assert_eq!(b.node, hopr("12.5 wxHOPR"));
        assert_eq!(b.safe, hopr("1000 wxHOPR"));
        Ok(())
    }

    /// The node and Safe figures are what the two halves of the assertion read, and they are
    /// adjacent camelCase keys — a swap would silently reverse every conclusion.
    #[test]
    fn a_balances_body_missing_a_field_should_fail_rather_than_default() {
        let body = r#"{"native":"1 xDai","safeHopr":"1000 wxHOPR"}"#;
        assert!(parse_balances(body).is_err());
    }

    /// The surplus is emitted every cycle whether or not a share is lost, so it is billed. Pricing
    /// the threshold alone would underpay by a fifth of the traffic at the shipped factor.
    #[cfg(feature = "pix")]
    #[test]
    fn the_quota_should_bill_the_surplus() -> anyhow::Result<()> {
        let with_surplus = quota_per_ssa()?;
        let threshold_only = edgli::quota_per_ssa(&edgli::pix_ssa_quota(
            &edgli::hopr_lib::config::HoprLibConfig {
                protocol: edgli::hopr_lib::exports::transport::HoprProtocolConfig {
                    pix: edgli::PixGlobalConfig {
                        additional_shares: Some(0),
                        ..dimensions()
                    },
                    ..Default::default()
                },
                ..Default::default()
            },
        )?);
        assert!(
            with_surplus > threshold_only,
            "the surplus must be counted in the quota: {with_surplus} vs {threshold_only}"
        );
        Ok(())
    }

    /// The dimensions have to sit inside the Exit's `--enable-pix` window, or every Session is
    /// refused with `UnacceptablePixParams` before a byte moves.
    #[cfg(feature = "pix")]
    #[test]
    fn the_quota_should_fall_inside_the_localcluster_window() -> anyhow::Result<()> {
        // `identity::PixSettings::default()` in hoprd-localcluster.
        const WINDOW_MAX: u64 = 1024 * 1024;
        let quota = quota_per_ssa()?;
        assert!(
            quota > 0 && quota <= WINDOW_MAX,
            "quota {quota} is outside the Exit's accepted range 0..={WINDOW_MAX}"
        );
        Ok(())
    }
}

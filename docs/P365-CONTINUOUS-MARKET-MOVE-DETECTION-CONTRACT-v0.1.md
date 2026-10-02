# P365 Continuous Market Move Detection Contract v0.1

**Checkpoint:** MOVE-001A
**Status:** PROPOSED NORMATIVE CONTRACT — OWNER MERGE PENDING
**Scope:** Continuous factual move detection for the MVP traded markets
**Primary MVP targets:** Bitcoin + Gold
**Supporting context:** Macro, DXY, ETH and other already-qualified evidence
**Implementation effect:** Documentation only. This checkpoint does not add runtime detection, persistence, scheduler changes, providers, UI, State/Regime/Risk/Intelligence, causal attribution, or trading logic.

## 1. Purpose

P365 must be able to notice an important market move before it knows why the move happened.

The existing event-response chain is valuable but cannot be the sole trigger for intraday analysis. A meaningful BTC or Gold move may begin without a qualifying scheduled economic Event. MOVE-001A therefore defines a first-class **move-driven analysis entry point** alongside the existing event-driven path.

The contract answers only:

> Has an MVP traded market moved enough, relative to an explicit point-in-time historical reference, to justify further evidence investigation?

It does not answer why the move happened.

## 2. Reproduced product gap — 2 Oct 2026

Production Market Memory already observed the BTC move that motivated this checkpoint.

| Observation | BTC spot | Factual comparison |
|---|---:|---:|
| `2026-10-02T02:30:20Z` / `09:30:20 WIB` | `84,912` | reference |
| `2026-10-02T03:30:30Z` / `10:30:30 WIB` | `85,239` | reference |
| `2026-10-02T04:30:30Z` / `11:30:30 WIB` | `86,752` | `+1.775%` versus ~60m earlier; `+2.167%` versus ~120m earlier |

The canonical ingestion path therefore captured the price facts. The failure was downstream: P365 had no continuous move detector that could promote the move into a market-analysis target when no qualifying scheduled Event acted as the parent trigger.

These values reproduce the product gap. They do **not** define permanent materiality thresholds and do not establish the cause of the move.

## 3. Trigger architecture

The approved product model has two independent trigger families:

```text
EVENT-DRIVEN
qualified Event
      |
      +--------------------+
                           v
                    analysis target
                           ^
      +--------------------+
      |
MOVE-DRIVEN
qualified material move
```

Neither trigger family replaces the other.

- Event-driven analysis remains appropriate for CPI, NFP, FOMC and other qualified catalysts.
- Move-driven analysis is required for unscheduled information, cross-asset repricing, flow/positioning changes, liquidation mechanics, changing expectations, or unexplained market moves.
- A move-driven target must not fabricate an Event identity merely to reuse event-specific code.

## 4. Canonical target markets

MOVE v0.1 is intentionally narrow.

First-class detection targets:

- `btc.spot.usd`
- `gold.futures.usd`

Supporting series such as ETH, DXY, rates, liquidity, flows and positioning may later participate in investigation, but MOVE-001A does not make them independent primary trigger targets.

Expanding first-class trigger targets requires a separate checkpoint.

## 5. Definitions

### Observed move

A deterministic percentage change between two compatible canonical observations of the same series.

### Candidate move

An observed move with valid point-in-time lineage that is eligible for historical materiality evaluation.

### Material move

A candidate move that crosses an explicitly versioned historical-materiality policy.

MOVE-001A intentionally freezes **no arbitrary fixed percentage threshold** such as `BTC >= 1%`.

Materiality must be calibrated from qualified historical move distributions and must remain explicit by series, horizon/alignment methodology, sample requirements and methodology version.

### Move-driven analysis target

A material move promoted for downstream evidence investigation. It is not an Event and must not be persisted or represented as a fabricated economic Event.

## 6. Point-in-time requirements

Every future detector evaluation must preserve what P365 could have known at the detector cutoff.

At minimum:

- current and comparison observations must be canonical and semantically compatible;
- both observations must satisfy their applicable quality / historical-fitness rules;
- `retrievedAt` must not exceed the detector `asOf` cutoff;
- later revisions must not leak backward;
- provider-specific convenience values must not replace canonical historical facts;
- direction and magnitude must be deterministic from the selected observations;
- exact Observation IDs, `observedAt`, `retrievedAt`, source and series identity must remain in lineage.

## 7. Horizon and alignment methodology

Continuous detection requires multiple intraday horizons so P365 can distinguish a fast impulse from a slower accumulation.

MOVE-001A does not freeze numerical runtime horizons merely by convention. The next calibration checkpoint must audit the actual production observation cadence and historical-pair density before freezing the first supported horizon set.

The calibration must explicitly define:

- requested elapsed horizon(s);
- how the comparison observation is selected;
- any permitted timestamp tolerance;
- how missing observations are handled;
- whether a candidate is rejected when alignment cannot be proven;
- historical sample lookback;
- minimum sample size;
- transformation;
- percentile or other deterministic materiality rule;
- methodology ID/version.

No nearest-neighbor, interpolation, forward-fill, backward-fill or observation-count approximation may be introduced silently.

## 8. Historical materiality

MOVE detection should reuse the existing HIST principles where compatible:

- same-series factual history;
- no lookahead;
- immutable point-in-time lineage;
- explicit transformation;
- explicit sample-size requirement;
- deterministic distribution evidence;
- fail closed on incomplete or incompatible history.

Existing HIST-001A/B may be reused directly only when the calibrated MOVE alignment and history requirements satisfy their invariants. If continuous detection needs a different bounded alignment policy, that policy must be frozen explicitly rather than weakening HIST defaults.

The detector must not convert a percentile into words such as `extreme`, `normal`, `bullish` or `bearish` unless a later consumer contract explicitly owns that interpretation.

## 9. Direction versus magnitude

Materiality and direction are separate facts.

A detector may retain:

- signed percentage change;
- absolute percentage magnitude;
- direction: `UP`, `DOWN`, or deterministic flat/zero handling;
- historical distribution evidence;
- materiality-policy result.

A positive or negative move is not itself evidence of continuation, reversal, regime, or trade direction.

## 10. Separation from cause investigation

MOVE detection ends when it identifies a qualified material market move.

A later move-investigation checkpoint may examine point-in-time evidence around that move, including:

- rates / real yields / policy pricing;
- DXY / broad USD;
- liquidity / funding;
- BTC ETF flow and stablecoin liquidity;
- Gold positioning / flow;
- derivatives / liquidation evidence when separately qualified;
- scheduled Events;
- unscheduled news / policy communication when separately qualified;
- supporting cross-asset observations and historical relationships.

That investigation must distinguish:

- supporting evidence;
- contradicting evidence;
- unavailable / stale evidence;
- `UNEXPLAINED` when evidence is insufficient.

It must not infer causality merely from temporal proximity or correlation.

## 11. Failure semantics

A future runtime must fail explicitly rather than silently classify.

Required high-level states are:

- `QUALIFIED` — candidate has valid lineage and materiality can be evaluated;
- `INSUFFICIENT_DATA` — history/alignment/sample coverage is inadequate;
- `INCOMPATIBLE` — inputs do not share the required series/semantic methodology;
- `UNKNOWN` — repository or another dependency prevents a truthful evaluation.

The later runtime checkpoint may add a separate materiality result only after calibration is frozen.

## 12. Acceptance criteria for MOVE-001A

MOVE-001A passes when the product contract clearly establishes that:

1. scheduled Event identity is not required to initiate intraday market analysis;
2. BTC and Gold can become first-class analysis targets because of their own price movement;
3. materiality is historical-distribution-based and versioned, not a guessed fixed percent;
4. detection preserves point-in-time Observation lineage and no-lookahead semantics;
5. the 2 Oct 2026 BTC production case is recorded as a reproduced trigger gap rather than a causal conclusion;
6. detector output is separated from driver/causality investigation;
7. an unexplained move is an acceptable truthful outcome;
8. existing Event, HIST, Market Memory and canonical Observation contracts remain intact;
9. no State / Regime / Risk / Intelligence or trading semantics are activated.

## 13. Explicit non-goals

MOVE-001A does not authorize:

- runtime detector code;
- scheduler changes;
- new database tables or persistence families;
- new provider/API acquisition;
- hardcoded move thresholds;
- automatic news scraping;
- causal attribution;
- prediction;
- continuation/reversal labels;
- bullish/bearish labels;
- State / Regime / Risk / Intelligence activation;
- BUY / SELL / LONG / SHORT;
- position sizing or execution;
- UI changes.

## 14. Dependency sequence

After owner merge, the bounded next sequence is:

```text
MOVE-001A  continuous move-detection contract
    ↓
MOVE calibration  production cadence + historical materiality methodology
    ↓
MOVE runtime  continuous BTC/Gold detector
    ↓
move-driven evidence investigation contract/runtime
    ↓
Briefing integration
```

Each remains an isolated checkpoint and PR.

The Event pipeline remains active throughout; this sequence adds the missing market-driven trigger path rather than replacing existing event-response work.

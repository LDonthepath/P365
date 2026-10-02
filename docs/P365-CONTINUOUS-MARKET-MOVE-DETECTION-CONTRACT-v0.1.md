# P365 Continuous Market Move Detection Contract v0.1

**Checkpoint:** MOVE-001A  
**Status:** CONTRACT PROPOSED / OWNER MERGE PENDING  
**Scope:** continuous material-move detection contract for MVP traded markets  
**MVP traded markets:** Bitcoin / Crypto + Gold  
**Explanatory layer:** Macro  
**Implementation effect:** documentation-only. This checkpoint does not add runtime code, persistence, scheduler jobs, providers, UI, State/Regime/Risk/Intelligence, causal attribution, or trading logic.

## 1. Product finding

P365 must not require a scheduled economic Event before it can recognize that something important is happening in the market.

The event-response chain remains valid for scheduled catalysts:

```text
Scheduled Event
  ↓
Expectation / Actual
  ↓
Surprise
  ↓
Repricing
  ↓
Transmission / Confirmation
```

But this is only one entry path into market intelligence.

The MVP also requires a market-first path:

```text
Continuous canonical market observations
  ↓
Observed market move
  ↓
Historical magnitude context
  ↓
Material-move candidate
  ↓
Evidence investigation
  ↓
Supporting / contradicting / missing evidence
  ↓
Potential driver set with explicit uncertainty
```

An economic Event may later appear as evidence for the move, but an Event is not a prerequisite for move detection.

## 2. Production evidence that motivated MOVE-001A

A read-only production Market Memory audit on **2 Oct 2026** reproduced the product gap with BTC.

P365 already held approximately five-minute canonical BTC spot observations throughout the move. At:

- **03:30:30 UTC / 10:30:30 WIB**, BTC was approximately **85,239 USD**;
- **04:30:30 UTC / 11:30:30 WIB**, BTC was approximately **86,752 USD**.

The durable history therefore contained a roughly **+1.775% 60-minute move** at 04:30:30 UTC. The same audit measured roughly **+2.167% over the preceding ~120-minute observation span**.

The important finding is not the exact percentage threshold. It is:

> **P365 possessed enough canonical price history to observe a substantial BTC move, but no active product path promoted that move into an investigation target unless a scheduled Event already anchored the analysis.**

This is a product-capability gap, not an ingestion failure.

No causal conclusion about the 2 Oct move is frozen by this contract. Public narratives, news reports, or later explanations are not retroactively promoted into canonical causality.

## 3. Purpose

MOVE-001A freezes the contract for detecting a market move independently of the economic-event lifecycle.

It answers only:

> Has an explicitly configured MVP traded-market series moved far enough, over an explicitly configured horizon, relative to an approved point-in-time historical distribution, to become a material-move investigation candidate?

It does **not** answer:

> Why did the market move?

Cause/driver investigation is a later checkpoint and must preserve evidence quality, timing, provenance, and uncertainty.

## 4. Dual-entry product architecture

P365 now recognizes two independent factual entry paths.

### A. Event-driven entry

Used when a qualified scheduled catalyst exists.

```text
Event
  ↓
SUR / RPR / TRN / EVR
```

Existing Event identity, Event Window, Snapshot, Surprise, Repricing, Transmission, and Event Response contracts remain unchanged.

### B. Move-driven entry

Used when the market itself is the trigger.

```text
Canonical BTC / Gold observations
  ↓
MOVE-001 material-move detection
  ↓
move-centered evidence window
  ↓
driver/evidence investigation
```

The move-driven path must work when:

- no scheduled Event exists near the move;
- an Event exists but is not yet proven relevant;
- the move begins before a scheduled release;
- the driver is market-native, flow-driven, positioning-driven, policy-communication-driven, or still unknown.

Neither path has semantic priority over the other.

## 5. Initial target scope

MOVE-001A keeps first-class detection aligned with the MVP traded markets:

- BTC spot: `btc.spot.usd`;
- Gold: `gold.futures.usd`, subject to later sample-adequacy calibration.

ETH, DXY, rates, real yields, liquidity, ETF flow, stablecoin liquidity, positioning, volatility, derivatives, news, and scheduled Events may be used later as **investigation evidence** when qualified. They are not silently promoted into move-detection targets by this contract.

Additional target series require an explicit later checkpoint.

## 6. Canonical input boundary

A future MOVE runtime must use durable canonical Observation history.

It must not:

- fetch a provider directly as a fallback;
- use dashboard-only transient values when durable canonical history is required;
- substitute another provider/series silently;
- interpolate hidden missing prices;
- use later-known revisions inside an earlier point-in-time assessment.

Minimum input lineage for one evaluated move:

- stable canonical series identity;
- source qualification where methodology requires source consistency;
- start Observation ID;
- end Observation ID;
- start and end `observedAt`;
- start and end `retrievedAt`;
- point-in-time knowledge cutoff;
- unit/frequency compatibility;
- quality/historical-fitness result.

## 7. Move measurement

The first approved magnitude family is:

```text
ABSOLUTE_PERCENT_CHANGE
```

Direction remains separately observable as a mechanical comparison:

- `UP`;
- `DOWN`;
- `FLAT`;
- `UNKNOWN`.

Absolute magnitude is used for materiality so that an upward and downward move of the same size are evaluated symmetrically.

Direction must not be translated into:

- bullish / bearish;
- risk-on / risk-off;
- continuation / reversal;
- buy / sell;
- long / short.

## 8. Horizon ownership

MOVE-001A does **not** reuse Event Window role labels such as `T_PLUS_5` or `T_PLUS_60`.

Continuous detection requires market-owned horizons.

Candidate horizons for the first calibration pass are:

- 15 minutes;
- 30 minutes;
- 60 minutes;
- 120 minutes.

These are **calibration candidates, not frozen production horizons**.

MOVE-001B must verify:

1. actual production sampling behavior for each target series;
2. an explicit start/end Observation pairing rule;
3. exact point-in-time semantics;
4. historical sample adequacy within repository bounds;
5. sensitivity to missing/irregular observations.

No nearest-point tolerance, observation-count shortcut, or interpolation may become production policy implicitly.

If a horizon cannot be reproduced deterministically from canonical history, that horizon must remain unavailable.

## 9. Historical materiality policy

MOVE materiality must be calibrated from the same-series historical distribution, reusing HIST-001 primitives where compatible.

The runtime must not hardcode a universal statement such as:

```text
BTC move >= 1% => MATERIAL
```

Instead, threshold ownership must remain explicit and versioned.

MOVE-001B calibration must at minimum evaluate:

- P50;
- P75;
- P90;
- P95;
- sample count;
- lookback window;
- pairing methodology;
- target series/source;
- horizon.

The existing RPR-002A empirical P90 methodology is valid **reference methodology**, but RPR-002B event-window thresholds must not be reused automatically for continuous detection because:

- the horizon set differs;
- observation-pair selection may differ;
- the target knowledge context differs;
- Event Window roles are not continuous-market horizons.

A production materiality threshold requires an owner-reviewed calibration checkpoint.

## 10. Candidate assessment state

A future MOVE assessment must fail closed.

Minimum outcome semantics:

- `MATERIAL_MOVE` — the qualified measured magnitude meets or exceeds the explicit calibrated threshold;
- `BELOW_MATERIALITY_THRESHOLD` — the qualified magnitude is below the threshold;
- `INSUFFICIENT_HISTORY` — the required historical distribution/sample adequacy is unavailable;
- `UNRESOLVED` — required canonical start/end observations cannot be qualified;
- `INCOMPATIBLE` — identity, source, unit, time, quality, or methodology invariants do not match.

A detected material move is only an **investigation target**.

It is not:

- a State;
- a Regime;
- a Risk score;
- Intelligence;
- a prediction;
- a causal conclusion;
- a trading signal.

## 11. Investigation handoff

A later move-investigation checkpoint may ask, around the qualified move window:

### Macro / rates / USD

- Did DXY or broad USD move materially?
- Did qualified rates / real-yield / policy-pricing evidence move?
- Did liquidity/funding evidence change on a compatible cadence?
- Was there a scheduled or unscheduled policy catalyst?

### Crypto-specific evidence

- Did ETH / broader crypto move with BTC?
- What did BTC ETF flow show at the knowledge cutoff?
- What did stablecoin liquidity show?
- When qualified, what did open interest, funding, basis, liquidations, volatility, or positioning show?

### Gold-specific evidence

- Did real yields / USD move with Gold?
- What did CFTC positioning show at the applicable knowledge cutoff?
- What did qualified Gold flow/holdings evidence show when available?

### Events / news

- Was a scheduled Event inside or near the move window?
- Was there source-qualified unscheduled evidence or policy communication?
- Did the move begin before the scheduled catalyst?

The output must distinguish:

- supporting evidence;
- contradicting evidence;
- neutral evidence;
- missing/unavailable evidence.

## 12. Causality boundary

MOVE-001A does not authorize statements of the form:

```text
BTC moved because X.
```

A later investigation layer may expose a bounded set of potential drivers only when the evidence and timing are explicit.

Until a separate causal methodology exists:

```text
causalAttribution = NOT_EVALUATED
```

must remain the governing boundary.

An acceptable move-centered result may therefore be:

```text
Material BTC move detected.
Several evidence classes are consistent with the move.
Causal attribution is not established.
```

or:

```text
Material BTC move detected.
No qualified driver currently explains it.
Status: UNEXPLAINED / INSUFFICIENT EVIDENCE.
```

Failing to explain a move is preferable to fabricating a narrative.

## 13. Relationship to current P365 contracts

MOVE-001A reuses rather than replaces:

- FND-001 durable historical Observation retrieval;
- FND-018A Observation identity/revision lineage;
- FND-002Q historical fitness semantics;
- HIST-001A/B single-series point-in-time historical distributions;
- REL-001 historical relationship evidence where later investigation explicitly requests it;
- canonical Observation semantics/provenance.

MOVE-001A does not weaken:

- EVW-001;
- CMP-001;
- RPR-001/RPR-002;
- SUR-001;
- TRN-001;
- EVR-001.

Those contracts remain the scheduled-event path.

## 14. Runtime sequencing

After owner merge, the bounded sequence is:

```text
MOVE-001A contract
  ↓
MOVE-001B continuous-horizon calibration
  ↓
MOVE-001C read-only detector runtime
  ↓
MOVE-002 move-centered evidence investigation
```

Provider expansion is not automatically authorized by this sequence.

If MOVE-002 proves that a required driver cannot be investigated with existing qualified evidence, that becomes a concrete demand-driven data requirement under FND-021.

## 15. Acceptance criteria

MOVE-001A passes when the repository contract makes all of the following explicit:

1. a scheduled Event is not required to trigger market-move detection;
2. the first-class detector targets remain bounded to BTC and Gold;
3. materiality is historical-distribution-based, not a universal hardcoded percentage;
4. continuous horizons are owned independently of Event Window roles;
5. start/end Observation pairing must be explicit and point-in-time safe;
6. no provider fallback, interpolation, or later-known lookahead is allowed;
7. a material move is an investigation target, not a causal conclusion;
8. unexplained moves remain valid explicit outcomes;
9. Event-driven and move-driven paths coexist;
10. no State/Regime/Risk/Intelligence or trading logic is activated.

## 16. Explicit non-scope

MOVE-001A does not add:

- runtime code;
- provider/network calls;
- new provider qualification;
- persistence/table/schema changes;
- scheduler changes;
- production thresholds;
- production horizons;
- dashboard/UI changes;
- notifications;
- derivatives providers;
- live Treasury/rates providers;
- automatic news attribution;
- causal inference;
- State / Regime / Risk / Intelligence;
- prediction;
- BUY / SELL / LONG / SHORT;
- position sizing;
- execution.

## 17. Checkpoint verdict

> **MOVE-001A: CONTINUOUS MARKET MOVE DETECTION CONTRACT PROPOSED / OWNER MERGE PENDING**

The checkpoint records the 2 Oct 2026 production product gap and changes the approved product entry model from event-only analysis to **dual-entry market awareness: scheduled-event-driven plus observed-move-driven**.

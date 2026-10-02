# P365 Point-in-Time Historical Baseline Contract v0.1

**Checkpoint:** HIST-001A  
**Status:** CONTRACT FROZEN / HIST-001A-D MERGED / HIST-001E EVENT-RESPONSE INTEGRATION IMPLEMENTED / OWNER MERGE PENDING  
**Scope:** read-only, single-series historical distribution baseline  
**MVP scope:** Macro explanatory layer + Crypto + Gold

## 1. Purpose

HIST-001A defines the missing historical-baseline methodology required by the P365
MVP decision-support contract.

It answers a narrow question:

> Relative to information that P365 could have known by a specified point in time,
> where does the current level or change sit within a defined historical distribution
> for the same canonical series and the same comparison methodology?

This is evidence for historical context. It is not a State, Regime, Risk,
Intelligence, prediction, causal conclusion, or trading signal.

The contract closes the semantic gap recorded in the operational SSOT:

`Historical baseline | MISSING | No approved methodology/query implementation.`

HIST-001A is contract-only. It does not add runtime code, persistence, providers,
scheduler jobs, UI, or derived market interpretation.

## 2. Product function

The user-facing need is:

> Is the current condition or move historically normal or unusual?

HIST-001A does not itself apply the words `normal` or `unusual`. It produces the
auditable historical distribution evidence required for a later caller to make an
explicitly governed classification.

Examples of future use include:

- where a 15-minute BTC return sits versus prior 15-minute BTC returns;
- where a 15-minute Gold return sits versus prior 15-minute Gold returns;
- where a 15-minute DXY return sits versus prior 15-minute DXY returns;
- where a CFTC Gold positioning level sits versus its own historical observations;
- where a stablecoin-liquidity daily change sits versus prior daily changes;
- where a BTC ETF-flow value or change sits versus its own eligible historical
  observations.

The comparison never substitutes one series for another.

## 3. Relationship to existing P365 baselines

HIST-001A is distinct from existing baseline types.

### Factual Baseline

FND-002/FND-002Q answer:

> What was the compatible predecessor factual observation?

That is a predecessor comparison, not a distribution.

### Expectation Baseline

EXP-001 answers:

> What expectation was knowable before an event?

That is event expectation evidence, not historical distribution evidence.

### Pricing Baseline

PRC-001 answers:

> What qualified market-pricing observation applied at the requested point in time?

That is point-in-time pricing reference evidence, not abnormality context.

### Historical Relationship

REL-001 answers:

> How were two canonical series historically associated under an explicit
> relationship methodology?

HIST-001A is single-series distribution evidence. REL-001 correlation must not be
used as a substitute for a historical baseline.

## 4. Historical Baseline request

Every future HIST-001 runtime request must provide explicit methodology rather than
relying on hidden defaults.

Required request concepts:

- canonical series identity:
  - legacy `domain`;
  - stable `seriesKey`;
- optional `sourceId` qualification when provider methodology must not be mixed;
- transformation;
- historical observation-window start;
- historical observation-window end;
- point-in-time knowledge cutoff `asOf`;
- explicit target Observation lineage;
- minimum transformed sample size;
- methodology ID;
- methodology version.

For change-based transforms the request must additionally provide:

- target start Observation;
- target end Observation;
- exact comparison horizon derived from those target observations.

Historical-window end must be strictly earlier than the target end observation.
The target therefore never contributes to its own historical reference distribution.

## 5. Approved v0.1 transformations

HIST-001A freezes four deterministic transformation families.

### LEVEL

Use the canonical numeric value of each eligible historical observation directly.

Suitable examples include a positioning level, flow level, inventory level, or other
series where comparing levels is economically meaningful.

A caller must not apply LEVEL merely because it is easier. For non-stationary market
prices such as BTC, Gold, or DXY, change-based transforms are generally the
appropriate future product use.

### ABSOLUTE_CHANGE

For an exact-horizon pair:

`endValue - startValue`

### PERCENT_CHANGE

For an exact-horizon pair:

`((endValue - startValue) / startValue) * 100`

A zero start value makes that historical sample ineligible.

### ABSOLUTE_PERCENT_CHANGE

For an exact-horizon pair:

`abs(((endValue - startValue) / startValue) * 100)`

This transform measures magnitude only. It deliberately removes direction and must
not be presented as bullish/bearish evidence.

No log-return, annualization, volatility scaling, interpolation, winsorization,
seasonal adjustment, or other transformation is authorized by v0.1.

## 6. Exact-horizon pairing

Change-based historical samples are strict in v0.1.

For every eligible end observation at time `t`, a historical sample exists only
when the same canonical series has an eligible start observation at exactly:

`t - comparisonHorizon`

No nearest-neighbor substitution, interpolation, forward-fill, backward-fill, or
calendar guess is allowed.

This deliberately mirrors the conservative REL-001 philosophy: insufficient exact
coverage must remain `INSUFFICIENT_DATA` rather than being repaired silently.

If production coverage later proves that exact-horizon pairing is too sparse for a
required MVP series/horizon, a separately approved alignment-methodology checkpoint
must define bounded tolerance before runtime behavior changes.

## 7. Point-in-time and revision semantics

Historical baseline reconstruction must preserve what P365 could have known at the
requested `asOf`.

All repository candidates must satisfy:

- the requested canonical series identity;
- optional source qualification where supplied;
- `observedAt` inside the historical window;
- canonical `retrievedAt <= asOf`.

For multiple factual revisions at one `observedAt`, select only the latest revision
that was knowable by `asOf`, using existing repository ordering semantics.

A later-known revision must never leak into an earlier historical reconstruction.

The target Observation or target pair must also have been knowable by `asOf`.

## 8. Historical predecessor fitness

HIST-001A reuses the existing FND-002Q distinction between current freshness and
historical factual fitness.

For historical distribution membership:

- `FRESH` is eligible when all other invariants pass;
- `STALE` may remain eligible as an immutable historical fact;
- `UNKNOWN` is ineligible;
- `PARTIAL` is ineligible.

Stored canonical quality is not rewritten or recomputed at read time.

A source-qualified historical-fitness policy may be approved only as an explicit,
versioned methodology exception when immutable canonical rows predate a qualified
freshness policy and cannot be safely rewritten.

Such an exception must:

- be opt-in per Historical Baseline methodology;
- identify one canonical source and one bounded series family;
- validate source-native provenance and approved semantics exactly;
- leave the stored Observation `quality` unchanged;
- never admit `PARTIAL`;
- fail closed when provenance, semantics, dataset, or instrument identity drifts;
- not alter the default HIST behavior for any other source.

The first approved exception is
`cftc-gold-cot-source-qualified-historical-fitness-v1`, limited to canonical
CFTC Gold Disaggregated Futures Only rows for contract code `088691`.

Under that policy, an immutable CFTC row stored as `UNKNOWN` may be historically
fit only when its canonical source, dataset `72hh-3qpy`, Futures Only report
family, contract code, provider resource, report date, native field lineage, and
approved Gold positioning semantics all match exactly.

This exception is historical factual fitness only. It does not relabel the raw
Observation as FRESH or STALE and does not claim an exact public release time.

Missing samples remain missing.

## 9. Compatibility rules

Every input used in one baseline must remain semantically compatible.

At minimum:

- same canonical `domain + seriesKey`;
- same source when a source-qualified request is used;
- finite numeric canonical values;
- compatible unit;
- compatible frequency/measurement meaning;
- compatible transformation;
- identical change horizon for every change-based sample.

Provider-specific convenience fields such as Yahoo `previousClose` must not become
hidden historical baseline inputs.

A baseline must fail closed rather than mix incompatible values.

## 10. Distribution evidence

A VALID v0.1 historical baseline exposes factual distribution evidence only.

Required output concepts:

- status;
- methodology ID/version;
- canonical series identity;
- optional source qualification;
- transformation;
- target transformed value;
- comparison horizon when applicable;
- historical window;
- `asOf`;
- eligible sample size;
- minimum required sample size;
- minimum sample value;
- maximum sample value;
- median sample value;
- target empirical percentile rank;
- exact Observation lineage used by the target and historical samples;
- explicit reason when not VALID.

### Median

For an ordered sample of size `n`:

- odd `n`: the middle value;
- even `n`: arithmetic mean of the two middle values.

### Empirical percentile rank

For target value `x` and historical sample size `n`:

`100 * (count(sample < x) + 0.5 * count(sample == x)) / n`

This mid-rank rule makes ties deterministic.

The output must not silently convert the percentile into labels such as:

- normal;
- unusual;
- extreme;
- overbought;
- oversold;
- bullish;
- bearish.

Threshold ownership belongs to a later explicit consumer.

## 11. Status semantics

Future runtime status must be explicit.

### VALID

All request, temporal, compatibility, sample-size, and arithmetic invariants pass.

### INSUFFICIENT_DATA

Examples:

- eligible transformed samples are fewer than caller-owned `minimumSampleSize`;
- exact-horizon pairs are too sparse;
- required target pair is unavailable.

### INCOMPATIBLE

Examples:

- target observations are not the requested canonical series;
- target pair uses incompatible units;
- target pair does not match the requested transform/horizon;
- candidate history changes semantic meaning inside one baseline.

### UNKNOWN

Repository failure or another condition prevents a truthful determination.

No failure state may be represented as an empty but VALID distribution.

## 12. Determinism and lineage

Equivalent point-in-time inputs must produce the same result regardless of repository
candidate ordering.

A future runtime identity must deterministically cover at least:

- methodology ID/version;
- canonical series identity;
- optional source qualification;
- transformation;
- historical window;
- comparison horizon where applicable;
- `asOf`;
- target Observation IDs;
- selected historical Observation IDs;
- transformed sample values.

HIST-001A itself does not authorize persistence. The identity requirement exists so
a future persisted consumer cannot lose methodology/input lineage.

## 13. Intraday use boundary

HIST-001A is specifically useful to the P365 intraday objective because event and
market-response evidence already produces explicit PRE/T+5/T+15/T+30/T+60
comparisons.

A later consumer may use matching historical horizons to answer questions such as:

> How large was the 15-minute BTC move relative to prior 15-minute BTC moves known by
> this point in time?

The historical baseline does not prove the event caused the move.

It also does not establish whether the move should continue or reverse.

## 14. Flow and positioning boundary

The same contract may later support slower evidence such as BTC ETF flows, stablecoin
liquidity, or CFTC Gold positioning, provided the caller chooses a transformation and
window appropriate to that series.

Different cadences must not be forced into one universal window.

For example:

- an intraday BTC price return baseline;
- a daily ETF-flow baseline;
- a weekly CFTC positioning baseline;

are separate historical-baseline requests even when they contribute to one later
market interpretation.

## 15. Historical relationship boundary

HIST-001A and REL-001 must remain separate.

HIST-001A:

`one series -> historical distribution context`

REL-001:

`two series -> historical association evidence`

A high percentile in HIST-001A does not establish correlation, transmission, or
causality.

A strong REL-001 correlation does not establish that the current observation is
historically unusual.

## 16. HIST-001B runtime implementation

HIST-001B implements this contract as a read-only application/domain layer over the existing `HistoricalObservationRepository`.

The implementation must prove with focused tests:

1. canonical series/source filtering;
2. `retrievedAt <= asOf` no-lookahead behavior;
3. latest-knowable revision selection;
4. strict historical-window exclusion of the target;
5. FRESH/STALE historical fitness and UNKNOWN/PARTIAL exclusion;
6. exact-horizon pairing with no interpolation/fill;
7. absolute and percent-change arithmetic;
8. zero-denominator rejection for percentage transforms;
9. deterministic median;
10. deterministic mid-rank percentile;
11. minimum-sample fail-closed behavior;
12. unit/semantic incompatibility handling;
13. deterministic input lineage independent of candidate ordering;
14. repository failure -> UNKNOWN;
15. no State/Regime/Risk/Intelligence/trading semantics.

The implementation reuses `HistoricalObservationRepository`; it does not create a second raw-history data source. Historical reads remain bounded to 500 rows per repository call; when that bound is reached and complete window coverage cannot be proven, HIST-001B fails closed with `UNKNOWN` rather than calculating a potentially truncated distribution.

## 17. HIST-001C event-window integration

HIST-001C binds a qualified PRE -> post-event Snapshot comparison to one or more
HIST-001B historical baselines.

The integration is factual context only.

For each explicitly requested Observation slot it:

- reuses CMP-001/EVW-001 qualification for the PRE and post-event Snapshot pair;
- resolves the exact canonical before/after Observation IDs referenced by those Snapshots;
- derives the comparison horizon from the actual Observation timestamps rather than
  assuming that an event-window role label equals the market-move horizon;
- sets the historical reference window to end strictly before the PRE Observation
  measurement;
- uses the post-event Snapshot `capturedAt` as the shared `asOf` knowledge cutoff;
- applies an explicit caller-owned HIST transformation, lookback, minimum sample size,
  methodology ID and methodology version;
- retains CMP contamination status and contaminating Event identities;
- retains every requested Observation key, including explicit missing coverage;
- embeds the exact HIST-001B evidence and lineage for each resolved series.

For example, a PRE Observation at 12:24:50 and a T+5 Observation at 12:34:50
produce a 10-minute historical comparison horizon. HIST-001C must not relabel that
as a 5-minute market move merely because the Snapshot role is `T_PLUS_5`.

HIST-001C does not assign percentile thresholds or words such as normal, unusual,
extreme, bullish or bearish.

## 18. HIST-001D intraday calibration

HIST-001D freezes one explicit first-use calibration for BTC, DXY and Gold event-window
historical magnitude context.

The calibrated policy is:

- transformation: `ABSOLUTE_PERCENT_CHANGE`;
- historical lookback: 36 hours;
- minimum eligible exact-horizon sample size: 30;
- BTC: `ASSET:btc.spot.usd:coingecko-market`;
- DXY: `ASSET:dxy.index.usd:yahoo-finance`;
- Gold: `ASSET:gold.futures.usd:yahoo-finance`;
- methodology ID: `intraday-event-magnitude-historical-context-v1`;
- methodology version: `v1`.

This policy answers only:

> How large was the observed PRE-to-post percentage move relative to same-series,
> same-horizon historical move magnitudes inside the calibrated lookback?

It deliberately removes move direction. It does not classify a percentile as normal,
unusual, extreme, bullish or bearish.

### Calibration evidence

A production durable-history audit on 1 Oct 2026 tested the actual PRE-to-post
horizons implied by EVW-001 when PRE is near T-5:

- 10 minutes;
- 20 minutes;
- 35 minutes;
- 65 minutes.

At a 36-hour lookback, distinct end-point counts remained below the repository
500-row bound for all three calibrated series:

- BTC: 432;
- DXY: 412;
- Gold: 419.

Exact same-series pairs at the four tested horizons were:

- BTC: 125-144;
- DXY: 113-154;
- Gold: 34-36.

Therefore a minimum sample size of 30 has current production support across all three
MVP target series while retaining bounded-history headroom.

A 42-hour candidate was rejected for v1 because DXY and Gold were already near the
repository cap at 466 and 480 distinct endpoints before accounting for the extra
start-horizon range or factual revisions.

These counts are calibration evidence, not a permanent market law. Any future change
to lookback, sample threshold, transformation, series, source, or methodology version
requires an explicit recalibration checkpoint.

## 19. HIST-001E event-response evidence integration

HIST-001E is the terminal HIST checkpoint for the current MVP sequence.

It binds the existing EVR-001 factual event-response chain to HIST-001C historical
context under one shared event/window/post-event knowledge lineage.

The integration requires:

- the same provider-independent Event identity;
- the same qualified Event Window;
- the same post-event role;
- the same CMP-001 comparison ID;
- the same post-event Snapshot `capturedAt` / knowledge cutoff;
- `causalAttribution = NOT_EVALUATED` on both EVR and historical context.

The generic HIST-001E builder still requires explicit historical-series methodology.
A separate calibrated intraday wrapper applies the frozen HIST-001D policy for
BTC, DXY and Gold.

HIST-001E does not add a dashboard query, UI surface, persistence owner, provider,
scheduler, percentile interpretation, State/Regime/Risk/Intelligence, or trading
logic. It closes the factual evidence-chain capability only.

After HIST-001E, HIST is frozen for the current MVP sequence. A further HIST
checkpoint requires a reproduced correctness/reliability defect or a concrete
downstream contract that cannot be satisfied by HIST-001A-E.

## 20. Out of scope

HIST-001A does not authorize:

- provider expansion;
- a new database or table;
- backfill;
- scheduler changes;
- persistence of historical-baseline outputs;
- percentile thresholds for `normal` or `unusual`;
- z-score thresholds;
- volatility models;
- regime classification;
- State/Risk/Intelligence;
- causal inference;
- event causality;
- prediction;
- BUY/SELL/LONG/SHORT;
- position sizing or execution;
- UI changes.

## 21. Checkpoint verdict

> **HIST-001A: CONTRACT FROZEN / PR #130 MERGED**  
> **HIST-001B: RUNTIME MERGED / PR #131**  
> **HIST-001C: EVENT-WINDOW INTEGRATION MERGED / PR #132**  
> **HIST-001D: INTRADAY CALIBRATION MERGED / PR #133**  
> **HIST-001E: EVENT-RESPONSE INTEGRATION IMPLEMENTED / OWNER MERGE PENDING**

The HIST-001A-E chain converts the historical-baseline gap into an explicit, point-in-time, no-lookahead, lineage-preserving historical-comparable capability integrated with factual event-response evidence. Interpretation and trading decisions remain outside the factual evidence layer.


## 20. GOLD-POS-001F CFTC source-qualified historical fitness

GOLD-POS-001F implements the first explicit source-qualified historical-fitness
policy permitted by Section 8:

`cftc-gold-cot-source-qualified-historical-fitness-v1`.

Default HIST behavior is unchanged:

- FRESH / STALE remain eligible;
- UNKNOWN / PARTIAL remain ineligible.

When and only when a caller opts into the CFTC policy, an UNKNOWN row may be
eligible if all CFTC Gold invariants pass exactly:

- domain = MARKET;
- sourceId = `cftc-gold-cot`;
- approved CFTC Gold COT series key;
- dataset = `72hh-3qpy`;
- provider resource = `/resource/72hh-3qpy.json`;
- contract market code = `088691`;
- report family = Disaggregated Futures Only;
- unit = CONTRACTS;
- frequency = WEEKLY;
- provenance observation date matches effective report date;
- native provider field matches compatibility metadata;
- approved COMMODITY / POSITIONING / US / FUTURE / GOLD semantics match exactly.

PARTIAL remains ineligible.

The policy is a compatibility bridge for immutable historical rows and is not a
freshness reclassification. Historical Baseline output retains the original
Observation quality, including UNKNOWN, for auditability.

A CFTC fitness policy attached to another source or non-CFTC series fails
validation before a historical distribution can be produced.

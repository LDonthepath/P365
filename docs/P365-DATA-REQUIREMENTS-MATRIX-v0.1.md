# P365 Data Requirements Matrix v0.1

**Status:** Active current-implementation requirements matrix, rebaselined under the financial-market ontology  
**Scope:** MVP = **Macro + Crypto + Gold** within a future-compatible global multi-asset architecture  
**Purpose:** Define field-level requirements and sequencing for the currently implemented foundation. The full product-domain universe and semantic classification are governed by `P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md`.

---

## 1. Purpose

P365 exists to explain the market, not merely to display it.

The data layer therefore must support this reasoning chain:

```text
Observe
  ↓
Compare
  ↓
Detect Surprise
  ↓
Detect Repricing
  ↓
Test Transmission
  ↓
Resolve Confirmation / Contradiction
  ↓
Explain Regime
  ↓
Market Briefing
```

This matrix translates each reasoning requirement into explicit data requirements, provenance rules, temporal requirements, and implementation priority.

### Authority boundary

This file remains authoritative for **field-level requirements, temporal discipline, source qualification, and the current implemented foundation**.

It is no longer the complete product-universe map. For market domains and information classes such as global central banks, equity internals, positioning, flows, derivatives, fiscal funding, global liquidity, and model estimates, use `P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md`.

The legacy P0/P1/P2 labels below describe sequencing for the current foundation. They must not be interpreted as a permanent statement that positioning, flows, global policy, or derivatives are outside the P365 product boundary.

For implementation prioritization, the MVP boundary is explicit:

```text
FIRST-CLASS MVP
Macro + Crypto + Gold

SUPPORTING EVIDENCE ONLY
Existing non-MVP cross-asset observations where useful

POST-MVP FIRST-CLASS EXPANSION
Equity / broad Credit / broad Commodities / other multi-asset domains
```

A supporting observation does not make its entire asset class part of MVP.

## 2. Non-goals

This matrix does **not** authorize implementation of:

- price prediction
- trade execution or signal copying
- portfolio allocation
- autonomous trading decisions
- hidden proxy metrics
- directional labels without evidence
- regime/liquidity/capital-flow formulas before their definitions and evidence requirements are approved

A provider or model must not be added merely because data is available. The data must satisfy a defined reasoning requirement.

---

## 3. Canonical reasoning-to-data map

Before reading the reasoning table, preserve the ontology distinction:

```text
Market domain
≠
Information class
≠
Jurisdiction
≠
Instrument / participant / tenor
```

Examples:

- US 10Y yield = `RATES / PRICING / US / 10Y`
- CPI actual = `ECONOMY / OBSERVATION / US`
- CPI consensus = `ECONOMY / EXPECTATION / US`
- COT = positioning semantics, not a generic market observation
- ETF net flow = `FLOW`, not price
- term premium = `MODEL_ESTIMATE`, not raw yield
- risk appetite = `DERIVED_STATE`, not provider fact


| Reasoning question | Required data class | Minimum requirement |
|---|---|---|
| What is happening now? | Current factual observations | Valid current observations with timestamp, unit, source, quality |
| What changed? | Historical/previous observations | At least one semantically compatible prior observation |
| Was the change surprising? | Expectation baseline | Actual, expected/consensus, forecast timestamp and source |
| Did the market reprice? | Market pricing | Pre-event and post-event market pricing with timestamps |
| Did the repricing transmit? | Cross-asset observations | Comparable pre/post observations across relevant assets |
| Is evidence independent? | Evidence/news/events | Source, publication/release time, URL/identifier, provenance |
| Is the condition persistent? | Baseline + Market Memory | Historical canonical references and immutable snapshots |
| What should the briefing explain? | Evidence + reasoning chain | Traceable facts, baselines, changes, confirmation/contradiction |

---

## 4. P0 — Minimum production data foundation

### 4.1 Macro factual observations

**Required domains**

- Monetary policy: FEDFUNDS, EFFR, Fed balance sheet, reserve balances
- Liquidity: M2, TGA, RRP
- Inflation: CPI, Core CPI, PCE, Core PCE
- Labor: unemployment, payrolls, initial claims
- Rates: US 2Y, US 10Y, 10Y real yield
- USD: broad USD measure / DXY
- Growth: real GDP

**Required fields**

- canonical observation ID
- series/metric ID
- domain
- value
- unit
- observation date/time
- publication/release timestamp where applicable
- source ID
- evidence ID
- data quality
- provenance metadata
- previous valid observation reference where available
- vintage/revision metadata where applicable

**Rules**

- Observation must remain factual.
- No interpretation or directional conclusion in the observation layer.
- Date semantics must be explicit: observation period is not automatically the release time.
- Revised data must not silently overwrite historical reasoning.

### 4.2 Economic events

**Required fields**

- event ID
- event type
- event name
- scheduled time
- release time
- importance
- actual value, if released
- expected/consensus value, if available
- previous value, if applicable
- source
- evidence ID
- event status

**Minimum use**

Economic events establish the temporal anchor for surprise and repricing analysis.

### 4.3 Crypto factual observations

For the MVP Macro + Crypto + Gold scope, the minimum factual crypto layer is:

- BTC price
- ETH price
- total crypto market capitalization
- BTC market capitalization
- ETH market capitalization
- BTC dominance
- ETH dominance
- stablecoin market capitalization
- volume
- basic volatility
- market breadth where a qualified source exists

**Required fields** follow the canonical Observation contract: asset/metric ID, value, unit, timestamp, source, evidence, quality, provenance.

**Important:** a crypto metric is not P0 merely because a provider exposes it. It is P0 only if it is required to answer an approved market-intelligence question.

### 4.4 Cross-asset factual observations

Minimum cross-asset set for transmission testing:

- S&P 500
- Nasdaq
- Russell 2000
- US 2Y yield
- US 10Y yield
- 10Y real yield
- USD / DXY
- gold
- oil
- VIX
- MOVE where available
- relevant crypto market observations

The purpose is not to create a trading dashboard. The purpose is to test whether market repricing is isolated or transmitted across assets.

### 4.5 News and evidence

News is evidence unless it satisfies the canonical requirements for an observation/event.

**Required fields**

- evidence ID
- headline/title
- publisher/source
- published timestamp
- URL or source identifier
- topic/category
- retrieved timestamp
- provenance/health metadata

**Rule:** news must not be silently promoted into a canonical Observation.

### 4.6 Historical canonical observations

The system must preserve enough valid history to support comparison.

Minimum requirement:

- current observation
- immediately preceding semantically compatible observation
- observation timestamp/period
- source and evidence lineage
- quality state

Historical depth may expand by reasoning requirement; there is no universal lookback period at this stage.

### 4.7 Source health and provenance

Every provider path must distinguish at minimum:

- HEALTHY
- EMPTY
- ERROR
- UNAVAILABLE
- STALE

Every canonical observation must remain traceable to its source and evidence.

### 4.8 Timestamp discipline

P365 must distinguish:

- observation timestamp
- observation period/date
- event scheduled timestamp
- event release timestamp
- market capture timestamp
- publication timestamp
- retrieval timestamp
- baseline timestamp

These timestamps must not be substituted for one another.

---

## 5. P1 — Required for genuine surprise/repricing intelligence

### 5.1 Expectation data

Required when asking whether an event surprised the market.

**Fields**

- expected value
- forecast range, where available
- number of forecasts, where available
- expectation source/provider
- forecast timestamp
- forecast horizon
- methodology/source type

Expectation must distinguish consensus/forecast from market-implied pricing.

### 5.2 Market pricing data

Required to establish whether an event produced repricing rather than merely a factual change.

**Rates**

- Fed funds futures
- SOFR futures
- OIS/rate expectations
- yield curve

**Volatility**

- VIX
- MOVE
- options implied volatility where available

**FX**

- DXY / major FX pricing

**Credit**

- HY/IG spread indicators

### 5.3 Pre-event and post-event snapshots

For material events:

```text
PRE-EVENT SNAPSHOT
        ↓
EVENT / RELEASE
        ↓
POST-EVENT SNAPSHOT
```

Each snapshot must be immutable and timestamped.

### 5.4 Cross-asset transmission observations

At minimum, collect comparable pre/post observations for the assets relevant to the event.

Example: determining whether CPI produced genuine market repricing requires, where available:

- CPI actual
- CPI expectation
- pre/post US 2Y yield
- pre/post DXY
- pre/post equity index
- pre/post crypto market observations
- event/release timestamps

The exact set is event-dependent; do not force unrelated assets into every analysis.

---

## 6. P2 — Deferred from the current implementation sequence until P0/P1 are mature

**Important:** `P2` here means deferred from the current runtime sequence, not excluded from the P365 financial-market product boundary. The financial-market ontology classifies several items below as SECONDARY or ENRICHMENT once history/baseline/snapshot prerequisites are met.


### 6.1 Positioning

- CFTC positioning
- futures positioning
- options positioning
- other qualified positioning datasets

**Status:** NOT READY.

### 6.2 Crypto derivatives

- open interest
- funding rates
- liquidations
- basis
- options implied volatility
- options positioning

**Status:** DEFERRED.

### 6.3 Advanced market structure

Any advanced microstructure/order-flow dataset must first have a defined reasoning question, source qualification, timestamp model, and baseline methodology.

**Status:** DEFERRED.

---

## 7. Baseline requirements

A baseline is a reference selected for a specific reasoning question, not a generic previous value.

| Baseline class | Requirement | Status |
|---|---|---|
| Factual | Previous valid canonical observation | READY / P0 |
| Expectation | Consensus/forecast with timestamp and provenance | P1 |
| Pricing | Actual market-implied pricing | P1 |
| Regime | Previous confirmed state | Deferred |
| Historical | Explicit historical methodology | P1/P2 depending on question |
| Cross-Asset | Pre-event observable state | P1 |
| Positioning | Canonical positioning data | P2 |

P365 must keep these concepts separate:

- absolute change
- expected surprise
- pricing surprise
- regime deviation
- historical abnormality

They must not be collapsed into one generic delta or score.

---

## 8. Source qualification criteria

A source qualifies for canonical use only when it provides enough information to establish:

1. **Identity** — what metric/event is this?
2. **Semantics** — what exactly does the value represent?
3. **Time** — when was it observed/released/published?
4. **Unit** — what unit and scaling apply?
5. **Provenance** — where did it come from?
6. **Continuity** — can compatible historical values be obtained?
7. **Quality** — can empty, stale, partial, and error states be distinguished?
8. **Reproducibility** — can the system trace the value back to its source/evidence?

A provider endpoint that returns a number but cannot satisfy these requirements should not become a canonical source merely for convenience.

---

## 9. Minimum viable dataset

The MVP must complete a useful reasoning chain for **Macro + Crypto + Gold**, not maximize breadth.

### Macro

Minimum macro coverage should support:

- economic reality: inflation, labor, growth and other approved releases;
- material central-bank policy/events/projections;
- liquidity/funding: balance sheets, reserves, M2, TGA/RRP, SOFR/EFFR/IORB where applicable;
- rates and real yields;
- USD / relevant FX context;
- inflation pricing;
- event expectation/actual/revision lifecycle;
- historical baseline and point-in-time market context.

### Crypto

Minimum crypto coverage should support:

- BTC and ETH spot;
- market capitalization / volume / dominance;
- historical comparison;
- stablecoin liquidity where a qualified source is approved;
- crypto ETF flow where required by an approved reasoning question;
- funding/OI/basis only when provider, time semantics and historical continuity qualify.

### Gold

Minimum Gold coverage should support:

- canonical Gold spot/futures pricing;
- durable history and factual baseline;
- interaction with real yields, USD, rates, inflation pricing and liquidity context;
- qualified ETF/positioning data only when required by an approved reasoning question.

### Supporting cross-asset evidence

Existing S&P 500, Nasdaq, Russell 2000, VIX, WTI and IG/HY data may remain available for context/transmission testing. They are **not** first-class MVP domain-expansion requirements.

### Evidence and history

All three MVP scopes require:

- source metadata and evidence linkage;
- correct publication/release/observation/retrieval timestamps;
- durable historical continuity;
- immutable snapshots when event reasoning is activated.

---

## 10. Explicitly deferred

Until the data foundation and definitions are approved, do **not** implement:

- Regime engine
- liquidity-flow engine
- capital-flow engine
- sentiment scoring
- portfolio engine
- trading signal engine
- proprietary composite scores
- hidden proxies for missing data
- automatic directional labels
- crypto derivatives layer
- positioning layer
- advanced market microstructure

This is a deliberate sequencing decision, not a permanent exclusion.

---

## 11. Implementation gate

Before implementing or replacing a provider, answer all of the following:

```text
What reasoning question does this data answer?
        ↓
What exact field is required?
        ↓
What is the observation/event/pricing timestamp?
        ↓
What baseline is required?
        ↓
What source qualifies?
        ↓
What is the minimum history required?
        ↓
How is provenance preserved?
        ↓
How is stale/partial/error distinguished?
        ↓
What existing canonical object consumes it?
```

If these questions cannot be answered, the provider/model change is premature.

### MVP vertical-slice gate

Before approving a **new first-class asset class** beyond Macro + Crypto + Gold, P365 must demonstrate the complete intelligence chain on the existing MVP:

```text
Macro change
→ correct factual / expectation / pricing baseline
→ event surprise when applicable
→ market repricing
→ rates / real yields / USD / liquidity transmission
→ Crypto response
→ Gold response
→ confirmation / contradiction from qualified evidence
→ historical context
→ next catalyst / invalidation
```

If that chain is not reliable and auditable, additional asset-class breadth is deferred.

Supporting evidence from an already available non-MVP asset does not violate this gate as long as it does not create a new first-class product module.

---

## 12. Current repository audit gate

The September 2026 re-audit against `main@b2275e7dc7424db157bc15193eda2d4033df088e` found that the runtime is ahead of this matrix in several places:

- the FRED registry contains 33 series, including SOFR, IORB, continued claims, JOLTS, quits, Sahm Rule, 10Y breakeven, 10Y-2Y, and IG/HY OAS;
- Yahoo provides Gold futures, Russell 2000, and DXY;
- CoinGecko provides BTC/ETH plus crypto-wide market observations;
- Biquote provides trial actual/forecast/previous/revision event-result data;
- durable Observation history has a contract plus Supabase adapter, while independent ingestion/backfill and repository-backed factual baseline remain open.

The audit also confirmed a semantic limitation: current `ObservationDomain = MARKET | MACRO | ASSET | OTHER` is too coarse for the full financial-market product universe. The ontology checkpoint therefore precedes provider expansion.


After this matrix is committed, the next task is a **gap analysis**, not immediate provider implementation.

The audit must classify every existing data path as:

- **CORRECT** — satisfies the matrix and canonical contracts
- **PARTIAL** — useful but missing required fields/history/provenance/quality
- **SEMANTICALLY WRONG** — data exists but does not represent the intended concept
- **DUPLICATE** — overlaps an existing canonical source without a justified role
- **MISSING** — required by the matrix but not implemented
- **DEFERRED** — intentionally outside the current implementation stage

Particular attention must be given to the current crypto market observation implementation. It must be evaluated against this matrix and the original product boundary before being treated as a canonical foundation.

No provider replacement should be performed solely because an existing endpoint fails to return a value. First determine whether that endpoint belongs in the approved architecture at all.


---

## 13. Financial-market data-foundation rebaseline

The current provider set must not be expanded by copying every capability in the ontology. Expansion must remain dependency-driven.

### 13.1 Core expansion gate

Before a new market domain is implemented, define:

1. the market mechanism being represented;
2. the information class;
3. jurisdiction/geography;
4. instrument/participant/tenor when relevant;
5. source-native time semantics;
6. historical continuity requirement;
7. baseline requirement;
8. source qualification and provenance;
9. whether the value is raw, deterministic derived, or model-estimated;
10. downstream reasoning question.

### 13.2 Current-domain semantic corrections required before broad expansion

The following current facts exist but need an additive semantic model rather than more ad-hoc Context scopes:

| Current data | Legacy classification | Target semantic family |
|---|---|---|
| SOFR / EFFR | MACRO | LIQUIDITY_FUNDING / PRICING |
| M2 / reserves / RRP | MACRO | LIQUIDITY_FUNDING / OBSERVATION |
| TGA | MACRO | FISCAL_SOVEREIGN / OBSERVATION |
| US 2Y / 10Y / real yield | MACRO | RATES / PRICING |
| 10Y breakeven | MACRO | RATES / PRICING |
| 10Y-2Y | MACRO | RATES / DERIVED_METRIC |
| IG/HY OAS | MACRO | CREDIT / PRICING |
| broad USD / DXY | MACRO or ASSET | FX / PRICING |
| S&P / Nasdaq / Russell | ASSET | EQUITY / PRICING |
| VIX | ASSET | VOLATILITY / PRICING |
| WTI / Gold | ASSET | COMMODITY / PRICING |
| BTC/ETH spot | ASSET | CRYPTO / PRICING |
| crypto dominance | MARKET | CRYPTO / DERIVED_METRIC |

These are **semantic reclassification targets**, not instructions to mutate existing Market Memory rows.

### 13.3 Expansion waves

After ontology compatibility, historical continuity, and factual-baseline ownership are secured, future provider/domain work should be isolated into waves:

- **MVP Macro wave:** material macro releases, central-bank policy/projections, liquidity/funding, rates, USD/relevant FX, and event expectations/pricing needed for approved macro reasoning.
- **MVP Crypto wave:** BTC/ETH market structure plus qualified stablecoin, ETF-flow and derivatives inputs only where required by approved MVP reasoning questions.
- **MVP Gold wave:** Gold pricing/history plus macro transmission context and qualified Gold flow/positioning enrichment.
- **Post-MVP domain expansion:** Equity, broad Credit, broad Commodities beyond Gold, and other multi-asset first-class domains.
- **Advanced methodology wave:** term premium, cross-currency basis, advanced options/dealer positioning, cross-border-flow decomposition, only when needed by the approved scope.

Each wave remains subject to one logical checkpoint per PR.

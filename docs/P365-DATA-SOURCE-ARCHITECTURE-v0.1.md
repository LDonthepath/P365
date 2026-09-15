# P365 Data Source Architecture v0.1

**Status:** DESIGN / SOURCE QUALIFICATION
**Scope:** Macro + Crypto implementation; architecture remains market-agnostic.
**Purpose:** Define which external sources are allowed to supply which factual data, what role each source may play, and what must be true before a provider becomes canonical.

---

## 1. Decision

P365 will not choose providers by API convenience alone.

A provider is qualified only when it can satisfy the reasoning requirement for the data it supplies:

```text
Reasoning requirement
        ↓
Required observation / event fields
        ↓
Source qualification
        ↓
Normalization
        ↓
Canonical role
        ↓
Evidence / Context / Snapshot / Memory
```

**Core rule:** a provider can be excellent for one role and invalid for another.

Example: Alpha Vantage may remain a news provider while its current crypto spot implementation is removed from the canonical market-data path. The current code registers these as two different source roles (`alpha-vantage` and `alpha-vantage-market`), which confirms that the distinction already exists in the domain layer. fileciteturn96file0L2-L6

---

## 2. Source-role rules

| Role | Meaning | Allowed to become canonical? |
|---|---|---:|
| `OBSERVATION` | Measured/quoted market or macro fact | Yes, after qualification |
| `EVENT` | Scheduled or released event with explicit timing | Yes, after qualification |
| `EVIDENCE` | News, article, transcript, document, narrative source | No automatic promotion to fact |
| `EXPECTATION` | Consensus/forecast reference | Yes, but separate from observation |
| `PRICING` | Market-implied expectation / probability / premium | Yes, but separate from consensus |
| `PROVENANCE` | Source and retrieval metadata | Supporting layer only |

No provider may silently convert news into an observation.

No provider may silently convert a forecast into market pricing.

No provider may silently substitute a proxy for a requested metric.

---

## 3. Qualification contract

Every candidate provider must be evaluated against these fields:

### Identity
- provider ID
- provider name
- endpoint / dataset
- instrument or series identifier
- unit
- quote currency where applicable

### Time
- `observedAt` — when the value represents the market/economic state
- `publishedAt` — when information was published
- `scheduledAt` — when an event is scheduled
- `releasedAt` — when an official result became public
- `retrievedAt` — when P365 fetched it
- `vintageDate` — which historical information set the value belongs to, when applicable

### Quality
- freshness
- completeness
- missing fields
- stale detection
- duplicate detection
- timestamp validity
- source health
- rate-limit / availability state

### Historical integrity
- historical depth
- reproducibility
- revision/vintage support
- stable identifiers
- ability to reconstruct pre/post-event state

### Provenance
- source ID
- source URL or endpoint
- retrieval timestamp
- provider response identifier where available
- transformation/version metadata

---

## 4. Current source decisions

### 4.1 FRED — QUALIFIED for Macro P0

**Role:** canonical macro observations.

Current implementation already uses FRED as the macro provider and has a defined P0 series universe.

FRED supports observations by series and exposes real-time/vintage controls. Its API distinguishes observation dates from real-time/vintage periods, which is important for future release/surprise reasoning. citeturn0search0turn0search2

**Keep:** current FRED foundation.

**Required follow-up:** distinguish these fields in P365:

```text
observationDate
releasedAt / releaseDate
retrievedAt
vintageDate
```

FRED also exposes release-date endpoints, but its documentation notes that published release dates do not necessarily equal the moment the data becomes available on FRED/ALFRED. Therefore P365 must not treat a release calendar timestamp as automatically equivalent to data availability. citeturn0search3

**Qualification status:** `QUALIFIED / P0`

---

### 4.2 Federal Reserve — QUALIFIED for FOMC events

**Role:** official monetary-policy event source.

Use the Federal Reserve as the canonical source for:
- FOMC meeting dates
- statements
- implementation notes
- press-conference timing
- minutes
- projection materials when applicable

The official FOMC calendar provides meeting dates and associated statement/minutes information. citeturn0search4

**Qualification status:** `QUALIFIED / P0 EVENT`

**Follow-up:** preserve official publication/release timestamps for statements and minutes instead of treating the meeting date as the release timestamp.

---

### 4.3 Alpha Vantage — QUALIFIED only for existing NEWS role

**Current role:** `NEWS`.

The domain source registry already distinguishes `alpha-vantage` (`NEWS`) from `alpha-vantage-market` (`MARKET`). fileciteturn96file0L2-L6

**Decision:** keep Alpha Vantage news only until a separate market-data qualification is completed.

The current `crypto-market.ts` calls Alpha Vantage `CURRENCY_EXCHANGE_RATE` for BTC/USD and ETH/USD. fileciteturn97file0L2-L7

That path is **not accepted as the P365 crypto-market foundation** because it supplies only spot exchange rates and does not satisfy the required market-universe fields.

**Action:** do not expand this provider into a pseudo-TOTAL3/dominance/volume source.

**Qualification status:** `QUALIFIED / NEWS ONLY`

---

### 4.4 CoinDesk — QUALIFIED for NEWS / EVIDENCE

**Role:** crypto news evidence.

CoinDesk may supply narrative evidence and source metadata.

It must not become a substitute for canonical market observations such as market cap, dominance, volume, breadth, or volatility.

**Qualification status:** `QUALIFIED / EVIDENCE`

---

### 4.5 Forex Factory — TEMPORARILY QUALIFIED for event awareness

**Current role:** economic calendar awareness.

Current implementation can provide:
- event name
- country
- impact
- scheduled time
- status

But this is insufficient for surprise reasoning because the P365 event contract ultimately needs:

```text
actual
expected
previous
scheduledAt
releasedAt
source
```

**Decision:** keep for calendar awareness, but do not classify it as the final canonical economic-release source until actual/expected/previous and release-time semantics are verified.

**Qualification status:** `PARTIAL / EVENT AWARENESS`

---

## 5. Crypto market source architecture

This is the highest-priority missing foundation.

### Required P0 universe

```text
BTC spot
ETH spot
Total crypto market cap
BTC market cap
ETH market cap
BTC dominance
ETH dominance
Stablecoin market cap
Market volume
Breadth
Volatility
```

The provider must support a consistent timestamp and enough historical data to construct:

```text
current observation
        ↓
previous canonical observation
        ↓
change
        ↓
historical baseline
```

### Provider decision

**Primary candidate:** a dedicated broad crypto market-data provider such as CoinGecko, subject to endpoint/rate-limit/history qualification.

**Do not use:** Alpha Vantage spot FX-style crypto rates as the broad market foundation.

**Important:** TOTAL3 and dominance should be derived only when the underlying market-cap universe and formula are explicitly documented. Never introduce a hidden proxy.

---

## 6. Cross-asset source architecture

Cross-asset data is required before P365 can explain transmission from macro events into crypto.

### Required factual universe

```text
S&P 500
Nasdaq
Russell 2000
US 2Y
US 10Y
10Y real yield
USD / DXY
Gold
Oil
VIX
MOVE
```

### Source qualification rule

Do not implement these as a random collection of free ticker endpoints.

The selected source must provide:
- stable identifiers
- timestamped observations
- historical data
- consistent units
- clear instrument definitions
- sufficient reliability
- reproducible retrieval

**Status:** `MISSING / SOURCE SELECTION REQUIRED`

### Important USD semantic constraint

The existing FRED `DTWEXBGS` series is a broad trade-weighted dollar index. It must **not** be labeled or treated as DXY without an explicit semantic decision.

Therefore:

```text
Broad Trade-Weighted USD ≠ DXY
```

P365 must either:
1. explicitly adopt broad trade-weighted USD as its USD metric, or
2. add a qualified DXY source.

No silent substitution.

---

## 7. Expectation source architecture

Expectation is a separate data class.

Required fields:

```text
indicator
period
expectedValue
forecastRange (if available)
source
forecastTimestamp
horizon
methodology / sourceType
```

Examples of acceptable source classes:
- official survey consensus
- professional economist consensus
- published forecast dataset

The following are **not interchangeable**:

```text
Consensus forecast
≠
Market-implied pricing
≠
Previous release
```

**Status:** `MISSING / SOURCE SELECTION REQUIRED`

---

## 8. Market-pricing source architecture

Market pricing is a separate P1 layer.

Required classes:
- Fed funds / policy-rate futures
- SOFR futures
- OIS / rate expectations where qualified
- yield-curve pricing
- VIX / MOVE
- options implied volatility
- major FX pricing
- credit spreads

**Status:** `DEFERRED UNTIL SOURCE QUALIFICATION`

Do not derive pricing surprise before this layer exists.

---

## 9. Event reasoning contract

The minimum event chain is:

```text
PRE-EVENT
   ↓
EVENT RELEASE
   ↓
ACTUAL vs EXPECTED
   ↓
MARKET REPRICING
   ↓
CROSS-ASSET TRANSMISSION
   ↓
POST-EVENT STATE
```

This means an event source alone is not enough.

P365 needs at least four synchronized layers:

1. event metadata
2. actual result
3. expectation
4. market observations before/after release

Without all four, P365 may report an event but must not claim a surprise/repricing explanation.

---

## 10. Canonical source matrix

| Data family | Required role | Current source | Status | Next action |
|---|---|---|---|---|
| Macro P0 | Observation | FRED | QUALIFIED | Harden release/vintage timestamps |
| FOMC | Event | Federal Reserve | QUALIFIED | Preserve official release timestamps |
| Macro news | Evidence | Alpha Vantage | QUALIFIED | Keep evidence-only |
| Crypto news | Evidence | CoinDesk | QUALIFIED | Keep evidence-only |
| Economic calendar | Event awareness | Forex Factory | PARTIAL | Qualify actual/expected/previous |
| BTC/ETH spot | Observation | Alpha Vantage Market | REJECTED for foundation | Replace with qualified crypto market source |
| Total crypto MCAP | Observation | — | MISSING | Qualify broad crypto provider |
| BTC/ETH MCAP | Observation | — | MISSING | Same provider where possible |
| BTC/ETH dominance | Observation | — | MISSING | Same provider or documented derivation |
| Stablecoin MCAP | Observation | — | MISSING | Qualify source/universe |
| Volume | Observation | — | MISSING | Define market-wide scope first |
| Breadth | Observation | — | MISSING | Define asset universe first |
| Volatility | Observation | — | MISSING | Define metric/universe first |
| Cross-asset | Observation | — | MISSING | Select qualified source architecture |
| Consensus | Expectation | — | MISSING | Select canonical expectation source |
| Market pricing | Pricing | — | DEFERRED | Qualify after P0 foundation |
| Positioning | Positioning | — | DEFERRED | P2 |
| Crypto derivatives | Derivatives | — | DEFERRED | P2 |

---

## 11. Implementation gates

### Gate A — Crypto market foundation

Cannot proceed until:
- provider selected
- field definitions fixed
- timestamps fixed
- historical depth verified
- rate limits known
- provenance model defined
- source health behavior defined

### Gate B — Cross-asset foundation

Cannot proceed until the factual cross-asset universe is available.

### Gate C — Expectation

Cannot implement surprise reasoning until consensus data is available and temporally aligned.

### Gate D — Repricing

Cannot implement pricing surprise until market-implied data is available.

### Gate E — Intelligence

Only after A–D can P365 safely reason about:

```text
WHAT happened?
WHY did the market care?
WHAT repriced?
DID transmission occur?
WHAT confirms it?
WHAT contradicts it?
```

---

## 12. Provider governance rules

1. One metric has one canonical definition.
2. A proxy must be explicitly named as a proxy.
3. A provider's convenience does not make it canonical.
4. News is evidence, not automatically fact.
5. Consensus is not pricing.
6. Observation date is not release timestamp.
7. Release timestamp is not retrieval timestamp.
8. Revised data must preserve vintage semantics where relevant.
9. Every canonical observation must have provenance.
10. Missing data must remain missing; do not fabricate completeness with hidden proxies.

---

## 13. Immediate next implementation checkpoint

**Do not build Intelligence yet.**

The next engineering checkpoint is:

> **Crypto Market Foundation v0.1 — provider qualification + canonical observation adapter.**

Deliverables:
1. select and qualify the broad crypto provider;
2. define exact P0 crypto fields;
3. define canonical IDs and units;
4. define timestamp semantics;
5. replace the current Alpha Vantage market path;
6. preserve the existing normalization/context pipeline;
7. add provider health and provenance;
8. verify historical continuity before exposing the data to reasoning layers.

The objective is not to make the dashboard show more numbers.

The objective is to make the numbers trustworthy enough that later reasoning is allowed to exist.

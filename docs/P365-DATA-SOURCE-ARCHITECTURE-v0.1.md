> **HISTORICAL CHECKPOINT — SUPERSEDED FOR CURRENT-STATE CLAIMS (18 Sep 2026)**
> This document is retained as an audit/design record. For current implementation status and remediation priority, use `docs/P365-CURRENT-STATE-v0.1.md`, `docs/P365-ROADMAP-v0.1.md`, and `docs/P365-CANONICAL-FOUNDATION-INTEGRITY-AUDIT-F0.md`. Do not treat older “current”, “missing”, or “next step” statements below as repository truth.

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

Alpha Vantage remains a news provider while its current crypto spot implementation is removed from the canonical market-data path.

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

**Qualification status:** `QUALIFIED / P0`

**Required follow-up:** distinguish observation date, release date, retrieval timestamp, and vintage semantics in P365.

---

### 4.2 Federal Reserve — QUALIFIED for FOMC events

**Role:** official monetary-policy event source.

Use the Federal Reserve as the canonical source for FOMC meeting dates and official monetary-policy publications.

**Qualification status:** `QUALIFIED / P0 EVENT`

**Follow-up:** preserve official publication/release timestamps instead of treating the meeting date as the release timestamp.

---

### 4.3 Alpha Vantage — QUALIFIED only for existing NEWS role

**Current role:** `NEWS`.

**Decision:** keep Alpha Vantage news only. Its crypto spot endpoint is not the canonical P365 market-data path.

**Qualification status:** `QUALIFIED / NEWS ONLY`

---

### 4.4 CoinDesk — QUALIFIED for NEWS / EVIDENCE

**Role:** crypto news evidence.

CoinDesk may supply narrative evidence and source metadata. It must not become a substitute for canonical market observations.

**Qualification status:** `QUALIFIED / EVIDENCE`

---

### 4.5 Forex Factory — TEMPORARILY QUALIFIED for event awareness

**Current role:** economic calendar awareness.

It can provide event name, country, impact, scheduled time, and status, but this remains insufficient for complete surprise reasoning without verified actual/expected/previous/release-time semantics.

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
Market volume
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

### Canonical provider decision

**CoinGecko is the canonical primary crypto market provider for P365 v0.1.**

CoinGecko is used for the first P0 crypto market foundation because its broad market endpoints can provide global market capitalization, market-wide volume, BTC/ETH dominance, and asset-level BTC/ETH observations from one provider family.

Canonical fields in v0.1:

| Canonical field | Domain | Unit / semantic |
|---|---|---|
| `BTC/USD spot rate` | ASSET | USD per BTC |
| `ETH/USD spot rate` | ASSET | USD per ETH |
| `BTC market cap` | ASSET | USD |
| `ETH market cap` | ASSET | USD |
| `Total crypto market cap` | MARKET | USD |
| `BTC dominance` | MARKET | percent of total crypto market cap |
| `ETH dominance` | MARKET | percent of total crypto market cap |
| `Total crypto 24h volume` | MARKET | USD |

**Not yet canonical:** stablecoin market cap, breadth, volatility. Those require separate metric definitions and qualification before implementation.

**Do not use:** Alpha Vantage spot exchange rates as the broad market foundation.

**Do not silently derive TOTAL3.** If a future model requires TOTAL3, its exact universe and formula must be documented first.

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

**Status:** `MISSING / SOURCE SELECTION REQUIRED`

### Important USD semantic constraint

The existing FRED `DTWEXBGS` series is a broad trade-weighted dollar index. It must not be labeled or treated as DXY without an explicit semantic decision.

```text
Broad Trade-Weighted USD ≠ DXY
```

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

Consensus forecast, market-implied pricing, and previous release remain separate concepts.

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

An event source alone is not enough. P365 needs event metadata, actual result, expectation, and synchronized market observations before/after release before claiming a surprise/repricing explanation.

---

## 10. Canonical source matrix

| Data family | Required role | Current source | Status | Next action |
|---|---|---|---|---|
| Macro P0 | Observation | FRED | QUALIFIED | Harden release/vintage timestamps |
| FOMC | Event | Federal Reserve | QUALIFIED | Preserve official release timestamps |
| Macro news | Evidence | Alpha Vantage | QUALIFIED | Keep evidence-only |
| Crypto news | Evidence | CoinDesk | QUALIFIED | Keep evidence-only |
| Economic calendar | Event awareness | Forex Factory | PARTIAL | Qualify actual/expected/previous |
| BTC/ETH spot | Observation | CoinGecko | QUALIFIED / P0 | Implement canonical adapter |
| Total crypto MCAP | Observation | CoinGecko | QUALIFIED / P0 | Implement canonical adapter |
| BTC/ETH MCAP | Observation | CoinGecko | QUALIFIED / P0 | Implement canonical adapter |
| BTC/ETH dominance | Observation | CoinGecko | QUALIFIED / P0 | Implement canonical adapter |
| Volume | Observation | CoinGecko | QUALIFIED / P0 | Implement canonical adapter |
| Stablecoin MCAP | Observation | — | MISSING | Define and qualify source/universe |
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

**Current checkpoint:** provider and field definitions are selected; engineering verification of the adapter and historical continuity remains.

### Gate B — Cross-asset foundation

Cannot proceed until the factual cross-asset universe is available.

### Gate C — Expectation

Cannot implement surprise reasoning until consensus data is available and temporally aligned.

### Gate D — Repricing

Cannot implement pricing surprise until market-implied data is available.

### Gate E — Intelligence

Only after A–D can P365 safely reason about what happened, why the market cared, what repriced, and whether transmission occurred.

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

> **Crypto Market Foundation v0.1 — CoinGecko adapter → canonical BTC/ETH/global observations.**

Deliverables:
1. implement the CoinGecko adapter;
2. define canonical IDs and units;
3. define timestamp semantics;
4. replace the current Alpha Vantage market path;
5. preserve the existing normalization/context pipeline;
6. add provider health and provenance;
7. verify historical continuity before exposing the data to reasoning layers.

The objective is not to make the dashboard show more numbers.

The objective is to make the numbers trustworthy enough that later reasoning is allowed to exist.

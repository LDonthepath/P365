> **HISTORICAL CHECKPOINT — SUPERSEDED FOR CURRENT-STATE CLAIMS (18 Sep 2026)**
> This document is retained as an audit/design record. For current implementation status and remediation priority, use `docs/P365-CURRENT-STATE-v0.1.md`, `docs/P365-ROADMAP-v0.1.md`, and `docs/P365-CANONICAL-FOUNDATION-INTEGRITY-AUDIT-F0.md`. Do not treat older “current”, “missing”, or “next step” statements below as repository truth.

# P365 Data Gap Analysis v0.1

**Status:** Phase 1 audit checkpoint  
**Scope:** Roadmap Phase 1 — Data Foundation  
**Product:** P365 Market Intelligence System  
**Audit basis:** `docs/P365-DATA-REQUIREMENTS-MATRIX-v0.1.md`, `docs/P365-DATA-SOURCE-ARCHITECTURE-v0.1.md`, current repository implementation

---

## 1. Purpose

This document audits the current repository against the Phase 1 Data Foundation requirements.

The audit is intentionally **data-first**. It does not authorize implementation of State, Regime, Risk, Intelligence, trading logic, capital-flow models, or sentiment scoring.

The audit uses six classifications:

- **CORRECT** — current path satisfies the relevant requirement and canonical contract.
- **PARTIAL** — useful implementation exists, but required semantics, fields, history, provenance, or quality handling are incomplete.
- **SEMANTICALLY WRONG** — the implementation represents a different concept from the required concept.
- **DUPLICATE** — overlapping paths exist without a justified canonical role.
- **MISSING** — required Phase 1 data path is not implemented.
- **DEFERRED** — intentionally outside the current Phase 1 implementation gate.

---

## 2. Executive finding

### Phase 1 is **NOT COMPLETE**.

The repository already has a meaningful factual foundation:

- FRED macro observations;
- Federal Reserve FOMC event awareness;
- Forex Factory calendar awareness;
- Alpha Vantage / CoinDesk evidence feeds;
- CoinGecko crypto market observations;
- canonical Observation / Event / Evidence normalization;
- provider health;
- Market Memory persistence infrastructure.

However, the foundation is not yet sufficient for genuine market-intelligence reasoning because several Phase 1 requirements remain missing or partial.

### Highest-priority gaps

1. **Cross-asset factual foundation is missing.**
2. **Expectation / consensus data is missing.**
3. **Market-pricing data is missing and belongs to the next P1 gate.**
4. **Economic event semantics are incomplete: actual, expected, previous, and release timestamp are not canonical.**
5. **Timestamp semantics are incomplete, especially macro observation date vs release date vs retrieval time.**
6. **Crypto P0 is implemented only partially: stablecoin market cap, breadth, and volatility are still missing.**
7. **Historical canonical continuity is incomplete. FRED currently carries previous value as metadata rather than a second canonical Observation.**
8. **Evidence provenance is incomplete because retrieval timestamp is not consistently represented in the canonical Evidence contract.**
9. **USD coverage is not DXY. `DTWEXBGS` is correctly named as a broad trade-weighted USD index, but the Phase 1 DXY requirement remains missing.**

Therefore the immediate work should remain inside **Phase 1 Data Foundation**.

---

## 3. Current canonical data paths

```text
Alpha Vantage NEWS
        ↓
      Evidence

CoinDesk NEWS
        ↓
      Evidence

Forex Factory
        ↓
  Event awareness

Federal Reserve
        ↓
  FOMC Event

FRED
        ↓
Canonical Macro Observation

CoinGecko
        ↓
Canonical Crypto Observation

Observation / Event / Evidence
        ↓
Normalization
        ↓
Context
        ↓
Market Memory
```

The repository's canonical domain types distinguish Observation, Event, Evidence, Context, State, Risk, Intelligence, and ProviderHealth. This is the correct architectural direction for Phase 1.

---

## 4. Audit by data family

| Data family | Status | Finding |
|---|---|---|
| Macro factual observations | **PARTIAL** | Strong FRED foundation, but release/retrieval/vintage semantics are incomplete |
| Macro P0 series coverage | **CORRECT** | 19 registered FRED P0 series cover the defined macro domains |
| Macro historical continuity | **PARTIAL** | FRED fetches multiple observations, but previous values are also carried as metadata and are not canonical Observation records |
| USD / DXY | **PARTIAL** | `DTWEXBGS` is correctly a broad USD index, but DXY itself is not present |
| FOMC official events | **PARTIAL** | Official schedule exists, but meeting date is not equivalent to release timestamp |
| Economic calendar | **PARTIAL** | Event awareness works, but actual/expected/previous/release semantics are absent |
| Macro news | **CORRECT / EVIDENCE** | Alpha Vantage is kept in NEWS/EVIDENCE role |
| Crypto news | **CORRECT / EVIDENCE** | CoinDesk and Alpha Vantage remain evidence paths |
| BTC spot | **CORRECT** | CoinGecko canonical Observation path exists |
| ETH spot | **CORRECT** | CoinGecko canonical Observation path exists |
| BTC market cap | **CORRECT** | Canonical Observation exists |
| ETH market cap | **CORRECT** | Canonical Observation exists |
| Total crypto market cap | **CORRECT** | CoinGecko `/global` canonical Observation exists |
| BTC dominance | **CORRECT** | CoinGecko `/global` canonical Observation exists |
| ETH dominance | **CORRECT** | CoinGecko `/global` canonical Observation exists |
| Total crypto 24h volume | **CORRECT** | CoinGecko `/global` canonical Observation exists |
| Stablecoin market cap | **MISSING** | Not canonical yet |
| Crypto breadth | **MISSING** | Universe and metric definition not established |
| Crypto volatility | **MISSING** | Metric/universe definition not established |
| Cross-asset equities | **MISSING** | No canonical S&P 500/Nasdaq/Russell observation path |
| Cross-asset rates | **PARTIAL** | US 2Y/10Y/10Y real yield exist through FRED macro foundation, but are not yet integrated as a cross-asset transmission dataset |
| Cross-asset FX | **MISSING** | DXY is not available as a canonical observation |
| Cross-asset commodities | **MISSING** | Gold and oil not implemented |
| Cross-asset volatility | **MISSING** | VIX/MOVE not implemented |
| Credit | **MISSING** | HY/IG spread indicators not implemented |
| Expectation / consensus | **MISSING** | No canonical expectation provider/layer |
| Market pricing | **MISSING / P1** | No canonical futures/OIS/options-implied pricing layer |
| Pre/post event snapshots | **MISSING** | Snapshot contract exists, capture engine does not |
| Source health | **PARTIAL / CORRECT FOUNDATION** | Provider health exists, but freshness/partial semantics are not yet uniform across all source types |
| Provenance | **PARTIAL** | Source IDs and evidence lineage exist; retrieval timestamp is not consistently represented as a first-class canonical field |
| Market Memory | **PARTIAL / FOUNDATION** | Append-only storage exists, but historical reasoning depends on ingestion frequency and canonical historical coverage |

---

## 5. Macro audit

### 5.1 FRED P0 registry — CORRECT

`lib/data/macro-registry.ts` defines 19 P0 series across:

- monetary policy;
- liquidity;
- inflation;
- labor;
- rates;
- USD;
- growth.

The registry explicitly records:

- series ID;
- canonical subject;
- frequency;
- unit;
- source;
- freshness window;
- cache duration.

This is a strong Phase 1 foundation.

### 5.2 FRED ingestion — PARTIAL

`lib/data/fred.ts` correctly validates date-only observations, rejects future dates, validates numeric values, fetches multiple recent observations, and preserves FRED `realtime_start` as `vintageDate`.

The gap is temporal semantics.

The current canonical normalization sets:

```text
observedAt = ingestion/capture time
metadata.observationDate = FRED observation period
metadata.releaseDate = null
```

This means the canonical Observation contract does not yet carry the actual economic observation timestamp/date as its primary temporal field.

**Phase 1 requirement:** observation period, release timestamp, retrieval timestamp, and vintage semantics must remain distinct.

### 5.3 Previous value — PARTIAL

FRED currently returns multiple recent records, but each record also contains `previousValue` metadata.

This is useful metadata but must not become a hidden substitute for historical canonical Observations.

The existing baseline audit already identifies the dependency: higher-order reasoning needs historical canonical Observation availability / Market Memory persistence rather than a hidden `previousValue` shortcut.

### 5.4 USD semantic issue — PARTIAL, not silent substitution

The current registry names `DTWEXBGS` as:

> US Broad Trade-Weighted Dollar Index

That is semantically correct.

The problem is that Phase 1 requires **USD / DXY** for cross-asset work.

Therefore:

```text
DTWEXBGS ≠ DXY
```

No code should relabel DTWEXBGS as DXY.

**Action:** add a qualified DXY source later in Phase 1 cross-asset implementation, while keeping DTWEXBGS as a separate broad-USD observation.

---

## 6. Economic event audit

### 6.1 Federal Reserve FOMC — PARTIAL

The official Federal Reserve calendar is correctly used as an authoritative source for FOMC meeting dates.

The implementation explicitly treats the date as a date anchor rather than a verified meeting/release time. That is correct and conservative.

Remaining gap:

- official publication timestamp;
- statement/release timestamp;
- actual policy decision/result;
- release evidence;
- post-event market anchor.

These belong to the event/repricing chain and should not be invented from the meeting date.

### 6.2 Forex Factory — PARTIAL

Current event records contain:

- event name;
- country;
- scheduled date/time;
- impact;
- status;
- source-derived identifier.

Missing:

- actual;
- consensus/expected;
- previous;
- release timestamp;
- release evidence.

Therefore Forex Factory currently supports **event awareness**, not full surprise analysis.

---

## 7. Evidence / news audit

### Alpha Vantage — CORRECT ROLE

Alpha Vantage is used for `NEWS_SENTIMENT`, not canonical market observations. This is aligned with the source architecture.

The feed preserves:

- title;
- source;
- published timestamp;
- summary;
- URL;
- topic/category.

### CoinDesk — CORRECT ROLE

CoinDesk remains a NEWS/EVIDENCE source and does not silently become a factual market source.

### Evidence provenance — PARTIAL

Canonical Evidence contains `sourceId` and `capturedAt`, but the current normalization for news uses the publication timestamp as `capturedAt`.

That conflates:

```text
publishedAt
      ≠
retrievedAt
```

Phase 1 should preserve both.

---

## 8. Crypto market audit

### Current CoinGecko path — CORRECT for implemented P0 fields

`lib/data/crypto-market.ts` uses:

- `/simple/price` for BTC/ETH price and market cap;
- `/global` for total market cap, total volume, BTC dominance, and ETH dominance.

The canonical output preserves:

- metric ID;
- symbol;
- value;
- observedAt;
- source;
- endpoint metadata;
- provider asset ID where applicable;
- retrieval time in metadata.

This satisfies the core factual role for the implemented metrics.

### Crypto P0 gaps

Still missing:

1. Stablecoin market capitalization.
2. Basic volatility.
3. Breadth, after an explicit asset universe is defined.

These should be added only after metric definitions and source qualification are approved.

### Important observation

The provider request includes `usd_24h_vol` at the asset level but the canonical adapter currently uses the global 24h volume instead. This is not a bug by itself; it is an explicit choice of market-wide volume. The unused asset-level field should not silently become another canonical metric.

---

## 9. Cross-asset audit

### Status: MISSING

No canonical provider path currently exists for the Phase 1 cross-asset factual universe:

```text
S&P 500
Nasdaq
Russell 2000
US 2Y
US 10Y
10Y real yield
DXY
Gold
Oil
VIX
MOVE
```

The existing FRED rates are valuable and already exist as macro observations, but they are not yet modeled as a cross-asset observation family suitable for transmission testing.

No equities, commodities, DXY, VIX, MOVE, or credit spread provider path was found in the repository audit.

### Phase 1 conclusion

Cross-asset foundation is the **largest missing factual block** in the current repository.

---

## 10. Expectation audit

### Status: MISSING

No canonical expectation/consensus dataset exists.

The architecture already recognizes `EXPECTATION` as a distinct source role, but the implementation does not yet have:

- expected value;
- forecast timestamp;
- forecast source;
- forecast horizon;
- forecast range;
- methodology/source type.

Therefore P365 cannot yet answer:

> Was the release surprising relative to expectations?

without risking unsupported inference.

---

## 11. Market pricing audit

### Status: MISSING / P1

No canonical pricing path exists for:

- Fed funds futures;
- SOFR futures;
- OIS/rate expectations;
- yield-curve pricing;
- VIX/MOVE market pricing;
- options implied volatility;
- major FX pricing;
- credit spreads.

This remains a P1 dependency and should not be mixed into the initial factual crypto implementation.

---

## 12. Historical / Market Memory audit

### Market Memory storage — CORRECT FOUNDATION

`SupabaseMarketMemoryStore` provides append-only canonical persistence with:

- record type;
- canonical ID;
- source ID;
- effective timestamp;
- capture timestamp;
- payload hash;
- deduplication.

This is appropriate infrastructure for historical continuity.

### Historical reasoning — PARTIAL

The current dashboard path persists observations/events/evidence when dashboard data is fetched. Therefore historical depth depends on actual ingestion frequency.

There is not yet a dedicated Phase 1 historical ingestion/backfill layer guaranteeing a known observation history independent of UI access.

**Action:** separate ingestion/history collection from UI access before declaring historical continuity complete.

---

## 13. Provider health audit

### Foundation — CORRECT

Provider results already distinguish:

- SUCCESS;
- EMPTY;
- ERROR;
- UNAVAILABLE.

Domain normalization maps these into source health states and records fetch time/item count/message.

### Gap — PARTIAL

`STALE` exists at the domain level, but freshness rules are not yet uniformly defined across all provider types.

Macro freshness is series-specific, while crypto freshness is currently based on observation age. Event/news freshness semantics are different and need explicit rules.

**Action:** define source-family-specific freshness semantics before Phase 1 completion.

---

## 14. Phase 1 backlog

### P0 — Must complete before Phase 1 can be considered production-ready

| Priority | Task | Classification |
|---|---|---|
| P0.1 | Preserve observation date, release timestamp, retrieval timestamp, vintage separately | PARTIAL → FIX |
| P0.2 | Build canonical cross-asset factual provider path | MISSING → BUILD |
| P0.3 | Add qualified DXY source | MISSING → BUILD |
| P0.4 | Add crypto stablecoin MCAP after definition/source qualification | MISSING → BUILD |
| P0.5 | Define and add crypto volatility metric | MISSING → BUILD |
| P0.6 | Define breadth universe before implementation | MISSING → DEFINE |
| P0.7 | Separate publication time from retrieval time in Evidence | PARTIAL → FIX |
| P0.8 | Establish historical ingestion/backfill path independent of UI | PARTIAL → FIX |
| P0.9 | Define source-family freshness semantics | PARTIAL → FIX |

### P1 — Required for surprise/repricing intelligence

| Priority | Task | Classification |
|---|---|---|
| P1.1 | Canonical expectation/consensus layer | MISSING |
| P1.2 | Actual/expected/previous/release fields for economic events | PARTIAL → FIX |
| P1.3 | Canonical market-pricing layer | MISSING |
| P1.4 | Pre/post-event snapshot capture | MISSING |
| P1.5 | Cross-asset transmission observation set | MISSING |
| P1.6 | Historical baseline methodology | PARTIAL |

### Deferred

- positioning;
- crypto derivatives;
- advanced market microstructure;
- State/Regime;
- Risk;
- Intelligence;
- Market Briefing.

---

## 15. What we should NOT change yet

Do not:

- add a Regime formula;
- add LDS/capital-flow formulas;
- add sentiment scoring;
- add trading signals;
- add crypto derivatives;
- add arbitrary composite scores;
- relabel DTWEXBGS as DXY;
- use previousValue as a hidden historical Observation;
- use news as factual market data;
- treat consensus as market pricing;
- make the UI responsible for reasoning.

These would move P365 beyond the Phase 1 gate without solving the actual foundation gaps.

---

## 16. Phase 1 completion gate

Phase 1 can be considered complete only when the following are true:

```text
P0 factual coverage
      ↓
Canonical timestamps
      ↓
Source health
      ↓
Provenance
      ↓
Historical continuity
      ↓
Cross-asset factual coverage
      ↓
Expectation layer
      ↓
Pricing layer
      ↓
Pre/Post event capture
      ↓
Phase 1 verification
```

At the current checkpoint, the repository is **not yet at the final Phase 1 gate**.

---

## 17. Immediate next step

The next implementation checkpoint should be:

> **Phase 1A — Canonical temporal + provenance hardening**

Before adding many new providers, fix the semantics of the data already entering P365:

1. separate observation date from retrieval time;
2. separate publication/release time from retrieval time;
3. preserve vintage semantics;
4. make historical observations canonical rather than metadata-only;
5. standardize provider health/freshness behavior.

Then proceed to:

> **Phase 1B — Cross-Asset Factual Foundation**

This sequencing gives P365 a reliable ingestion contract before multiplying provider integrations.

---

## 18. Audit conclusion

P365 is **not blocked by lack of data everywhere**. It is blocked by a smaller number of high-value semantic and coverage gaps.

The strongest existing foundations are:

- FRED macro registry + ingestion;
- CoinGecko crypto foundation;
- canonical Observation/Event/Evidence normalization;
- source health;
- Market Memory storage.

The most important missing foundation is **cross-asset coverage**, followed by **expectation/pricing semantics**.

The correct strategy is therefore:

```text
Harden what already exists
        ↓
Add cross-asset factual coverage
        ↓
Add expectation
        ↓
Add pricing
        ↓
Verify historical continuity
        ↓
Only then move beyond Phase 1
```

No reasoning engine should be advanced ahead of this sequence.

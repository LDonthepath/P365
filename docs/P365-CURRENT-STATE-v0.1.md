# P365 Current State v0.1

**Status:** Repository state checkpoint  
**Last checkpoint:** 2026-09-15  
**Product:** P365 Market Intelligence System

---

## 1. Executive state

P365 is currently a **Market Intelligence System foundation**.

The architecture is market-agnostic, while the current implementation coverage is **Macro + Crypto**. Crypto is an implementation domain, not the product boundary.

The system currently has a working canonical-data path and dashboard presentation, but it does **not yet have a production reasoning engine** for State, Risk, Intelligence, or Market Briefing.

Current maturity is therefore:

```text
Product boundary          ✅ Established
Domain contracts           ✅ Established
Canonical observations     ✅ Implemented
Events / Evidence         ✅ Foundation implemented
Context                    ✅ Implemented
Crypto market foundation  ✅ Implemented
Macro factual foundation  ✅ Implemented
Baseline                  🟡 Design-level
Market Memory             🟡 Design + storage foundation
Market Snapshot           🟡 Design-level
Cross-asset reasoning     ❌ Not implemented
State / Regime            ⏸ Deferred
Risk                      ⏸ Deferred
Intelligence              ⏸ Deferred
Market Briefing           ⏸ Deferred
Multi-market expansion    ⏸ Future
```

---

## 2. What is working

### Product boundary

P365 is explicitly defined as:

> A system that explains the market, not merely displays it.

It is not:

- a trading bot;
- an execution system;
- a signal copier;
- a price predictor;
- a portfolio engine.

### Domain architecture

The core contracts remain market-agnostic. New market domains should be added through qualified providers and canonical observations rather than by redesigning the core model.

### Macro

The FRED foundation is implemented with a registered P0 macro series set covering:

- monetary policy;
- liquidity;
- inflation;
- labor;
- rates;
- USD measure;
- growth.

Historical observations, provenance, quality state, and previous-value metadata are preserved.

**Known semantic gap:** the current USD series `DTWEXBGS` is a broad trade-weighted dollar index, not the DXY. It must not be silently represented as DXY.

### Economic events

FOMC/official event foundation and economic-calendar awareness exist.

The event layer is not yet sufficient for full surprise/repricing analysis because canonical actual/consensus/release-time coverage is incomplete.

### News / Evidence

News remains Evidence rather than being silently promoted into factual Observation.

Alpha Vantage and CoinDesk are used in evidence/news roles.

### Context

Context v0.2 is implemented as a neutral grouping layer.

Current groups include Macro scopes, Economic Events, and Crypto Market.

Context does not infer market direction, regime, sentiment, liquidity flow, or capital flow.

### Crypto market foundation

CoinGecko is the selected primary crypto market provider.

The current implementation exposes factual observations for:

- BTC price;
- ETH price;
- BTC market cap;
- ETH market cap;
- total crypto market cap;
- total crypto 24h volume;
- BTC dominance;
- ETH dominance.

The provider path uses CoinGecko market endpoints and preserves source/provenance and health information through the data layer.

The dashboard now renders these CoinGecko observations directly.

**Important:** this does not turn P365 into a crypto product. It is the first market-domain implementation used to validate the market-agnostic architecture.

### Dashboard

The dashboard currently contains navigation for:

- Overview;
- Macro;
- Crypto;
- Context;
- Intelligence;
- Evidence.

Crypto market foundation metrics are visible in the UI.

The UI is still a presentation layer and does not own domain reasoning.

---

## 3. What is not yet complete

### Market-domain coverage

Current implementation is incomplete relative to the long-term P365 objective.

Missing or incomplete factual foundations include qualified coverage for:

- Equities;
- Rates beyond the existing macro series where required for transmission analysis;
- FX / DXY;
- Commodities;
- Credit;
- Volatility such as MOVE where required.

The Data Requirements Matrix already defines much of the required cross-asset foundation.

### Expectation baseline

Consensus/forecast data is not yet implemented as a canonical expectation layer.

Therefore P365 cannot yet reliably answer:

> Was the factual release surprising relative to what the market expected?

### Pricing baseline

Market-implied pricing data is not yet implemented as a canonical pricing layer.

Therefore P365 cannot yet reliably distinguish:

> A factual surprise from a genuine market repricing.

### Cross-asset transmission

The system has not yet implemented the evidence and comparison machinery required to determine whether repricing transmitted across markets.

### Baseline / Market Memory

The concepts and governance are established, and Market Memory storage infrastructure exists, but the full comparison engine is not yet implemented.

### Market Snapshot

The immutable snapshot contract exists at design level, but the capture/comparison engine is not yet implemented.

### State / Regime

Deferred.

No regime formula, composite score, or directional label should be added until the required factual, baseline, snapshot, and cross-asset evidence foundation exists.

### Risk

Deferred until State and relevant evidence/event relationships are defined.

### Intelligence

Deferred until the underlying reasoning chain is sufficiently mature.

Target structure:

```text
WHAT
WHY
CONFIRMS
CONTRADICTS
INVALIDATES
MONITOR
```

### Market Briefing

Deferred until Intelligence exists.

The briefing must synthesize canonical intelligence and must not invent facts.

---

## 4. Current architecture state

```text
Provider
  ↓
Ingestion
  ↓
Normalization
  ↓
Observation / Event / Evidence
  ↓
Context
  ↓
Baseline / Market Snapshot / Market Memory
  ↓
State / Repricing / Regime Analysis
  ↓
Intelligence
  ↓
Briefing
  ↓
UI
```

Current implementation reaches reliably into the first part of this flow.

The later reasoning stages remain design/deferred rather than partially invented.

---

## 5. Current repository checkpoints

| Area | State | Notes |
|---|---|---|
| Product architecture | COMPLETE | Market-agnostic foundation established |
| Domain contracts | COMPLETE | Canonical types and invariants hardened |
| Data requirements | COMPLETE | P0/P1/P2 requirements defined |
| Source architecture | COMPLETE | Provider roles and qualification rules defined |
| FRED macro | IMPLEMENTED | 19 P0 series registered |
| Economic events | PARTIAL | Event awareness exists; surprise fields incomplete |
| News / Evidence | IMPLEMENTED | News kept separate from factual observations |
| Context | IMPLEMENTED | Neutral grouping and traceability |
| Crypto market | IMPLEMENTED | CoinGecko selected and wired |
| Dashboard UI | IMPLEMENTED | Crypto foundation metrics visible |
| Baseline | DESIGN | Contract/governance exists; engine pending |
| Market Memory | FOUNDATION | Governance + storage foundation exists |
| Market Snapshot | DESIGN | Immutable contract exists; engine pending |
| Cross-asset | MISSING | Provider/data coverage and reasoning pending |
| State / Regime | DEFERRED | Definition/evidence gate not passed |
| Risk | DEFERRED | Depends on State |
| Intelligence | DEFERRED | Depends on reasoning foundation |
| Market Briefing | DEFERRED | Depends on Intelligence |

---

## 6. Immediate next step

The next work should be a **repository-wide data gap analysis** against:

`docs/P365-DATA-REQUIREMENTS-MATRIX-v0.1.md`

Classify every current path as:

- CORRECT;
- PARTIAL;
- SEMANTICALLY WRONG;
- DUPLICATE;
- MISSING;
- DEFERRED.

The purpose is to complete the multi-market factual foundation without prematurely building a crypto-only intelligence engine.

After the gap analysis:

```text
Data Foundation
      ↓
Baseline / Market Memory
      ↓
Market Snapshot
      ↓
Cross-Asset Transmission
      ↓
State
      ↓
Risk
      ↓
Intelligence
      ↓
Market Briefing
```

One stage at a time. One isolated change at a time. One verification checkpoint at a time.

---

## 7. Source of truth for project direction

For product direction and sequencing, use:

- `docs/P365-ARCHITECTURE.md`
- `docs/P365-ROADMAP-v0.1.md`
- `docs/P365-DATA-REQUIREMENTS-MATRIX-v0.1.md`
- `docs/P365-DATA-SOURCE-ARCHITECTURE-v0.1.md`
- `docs/P365-MARKET-REASONING-BASELINE-v0.2.md`
- `docs/P365-MARKET-SNAPSHOT-CONTRACT-v0.1.md`
- `docs/P365-MARKET-MEMORY-GOVERNANCE-v0.1.md`

This Current State document records **where the repository is now**. It does not override the architecture or roadmap when implementation changes later.

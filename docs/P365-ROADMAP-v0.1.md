# P365 Roadmap v0.1

**Status:** Active roadmap  
**Product:** P365 Market Intelligence System  
**Current implementation scope:** Macro + Crypto  
**Long-term scope:** Multi-market / cross-asset market intelligence

---

## 1. Product destination

P365 is a **Market Intelligence System**, not a crypto-only dashboard.

The long-term objective is to read, connect, and explain market conditions across multiple market domains and produce a human-readable **Market Briefing**.

> **P365 exists to explain the market, not merely to display it.**

Crypto is the current implementation domain used to validate the architecture. It is not the product boundary.

---

## 2. Target market domains

The architecture must remain market-agnostic so new domains can be added without redesigning the core reasoning model.

### Initial domains

- Macro
- Crypto

### Expansion domains

- Equities
- Rates
- FX
- Commodities
- Credit
- Volatility
- Other qualified market domains

The system should eventually reason across domains rather than treating each market as an isolated dashboard.

---

## 3. Canonical system flow

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
Baseline
  ↓
Market Snapshot
  ↓
Market Memory
  ↓
State
  ↓
Risk
  ↓
Intelligence
  ↓
Market Briefing
  ↓
UI
```

The UI is a presentation layer. It must not become the owner of market reasoning.

---

## 4. Reasoning flow

P365 reasons about **change relative to context**, not isolated values.

```text
Observe
  ↓
Compare
  ↓
Detect Change / Surprise
  ↓
Detect Repricing
  ↓
Test Cross-Asset Transmission
  ↓
Resolve Confirmation / Contradiction
  ↓
Explain Market State / Regime
  ↓
Market Briefing
```

The exact reasoning rules for State, Regime, Risk, and Intelligence must be defined before implementation.

---

## 5. Roadmap phases

### Phase 0 — Product & Domain Foundation
**Status: COMPLETE / BASELINED**

- Establish P365 product boundary.
- Establish Market Intelligence System classification.
- Establish Market Briefing as the intended human-facing output.
- Establish market-agnostic domain contracts.
- Establish Observation / Event / Evidence / Context concepts.
- Establish canonical data flow and invariants.
- Explicitly reject trading-bot, execution, price-prediction, and hidden-proxy scope.

### Phase 1 — Data Foundation
**Status: IN PROGRESS**

Build a qualified factual foundation across market domains.

#### Macro
- FRED factual macro observations.
- Official Federal Reserve event/FOMC records.
- Economic calendar awareness.
- Timestamp and provenance discipline.

#### Crypto
- BTC.
- ETH.
- Total crypto market capitalization.
- BTC/ETH market capitalization and dominance.
- Volume and other factual market metrics only when source-qualified.
- CoinGecko is the selected primary crypto market provider.

#### Cross-asset
Establish qualified observations for:

- S&P 500.
- Nasdaq.
- Russell 2000.
- US 2Y.
- US 10Y.
- 10Y real yield.
- USD / DXY.
- Gold.
- Oil.
- VIX.
- MOVE where qualified.

#### Evidence
- News and source records.
- Publication/release timestamps.
- Provenance.
- Source health.

**Gate:** every provider must answer a defined reasoning requirement and satisfy identity, semantics, time, unit, provenance, continuity, quality, and reproducibility requirements.

### Phase 2 — Baseline & Market Memory
**Status: PARTIAL / DESIGN COMPLETE**

Implement validated comparison references and historical memory.

- Factual baseline.
- Expectation baseline.
- Pricing baseline.
- Historical baseline.
- Cross-asset baseline.
- Immutable historical references.
- Explicit temporal semantics.
- No universal or hidden delta.
- Market Memory must not become a second source of truth.

### Phase 3 — Market Snapshot
**Status: DESIGN COMPLETE / IMPLEMENTATION PENDING**

Implement immutable capture-time market snapshots.

```text
PRE-EVENT
   ↓
EVENT / RELEASE
   ↓
POST-EVENT
   ↓
COMPARE
```

Snapshots must preserve what was observable at capture time and must not be rewritten using later information.

### Phase 4 — Cross-Asset Context & Transmission
**Status: NOT STARTED**

Move from isolated market observations toward relationships between markets.

Questions include:

- Is a move isolated or broad?
- Which assets moved together?
- Which assets diverged?
- Did a material event transmit across markets?
- Is the observed relationship supported by comparable timestamps and evidence?

No directional conclusion should be created without an approved reasoning rule.

### Phase 5 — Market State / Regime
**Status: DEFERRED**

Define and implement a defensible State/Regime model only after the required data, baselines, snapshots, and cross-asset evidence exist.

Requirements:

- explicit definition;
- observable inputs;
- baseline methodology;
- confidence rules;
- evidence lineage;
- contradiction handling;
- no arbitrary composite score.

### Phase 6 — Risk Context
**Status: DEFERRED**

Define Risk as uncertainty/adverse-condition context derived from canonical State and relevant evidence/events.

Risk must not become a trading signal or portfolio recommendation.

### Phase 7 — Intelligence Engine
**Status: DEFERRED**

Synthesize canonical facts and reasoning into:

```text
WHAT
WHY
CONFIRMS
CONTRADICTS
INVALIDATES
MONITOR
```

Intelligence must remain evidence-based and traceable.

### Phase 8 — Market Briefing
**Status: DEFERRED**

Produce the human-facing market synthesis.

The briefing should explain:

- what changed;
- why it matters;
- what was expected;
- what was already priced;
- how the change transmitted across assets;
- what confirms the interpretation;
- what contradicts it;
- what could invalidate it;
- what should be monitored next.

### Phase 9 — Multi-Market Expansion
**Status: FUTURE**

Expand beyond the initial Macro + Crypto implementation without changing the core domain model.

Priority candidates:

1. Equities.
2. Rates.
3. FX.
4. Commodities.
5. Credit.
6. Volatility.
7. Additional qualified domains.

The order may change according to reasoning value and source quality.

---

## 6. Sequencing rule

P365 follows one strict development rule:

> **One stage = one isolated change = one verification checkpoint.**

Domain reasoning must be established before it is encoded.

Do not implement State, Risk, Intelligence, or trading-oriented models merely because the UI has enough numbers to display them.

---

## 7. Current priority

The immediate priority is **not** to build a crypto-only intelligence engine.

The priority is to complete the **market-agnostic data foundation and repository gap analysis** across the intended market domains.

Next checkpoints:

1. Audit current data paths against the Data Requirements Matrix.
2. Separate CORRECT / PARTIAL / SEMANTICALLY WRONG / DUPLICATE / MISSING / DEFERRED.
3. Identify qualified providers for missing market domains.
4. Complete canonical observation coverage.
5. Implement Baseline / Market Memory.
6. Implement Market Snapshot.
7. Build cross-asset reasoning only after the underlying evidence is ready.

---

## 8. Explicit non-goals

The roadmap does not authorize:

- price prediction;
- trade execution;
- signal copying;
- autonomous trading;
- portfolio allocation;
- hidden proxies for missing data;
- arbitrary market scores;
- premature sentiment scoring;
- premature liquidity/capital-flow formulas;
- premature crypto derivatives/positioning models.

These may only be reconsidered if they become justified by a separate approved product/reasoning requirement.

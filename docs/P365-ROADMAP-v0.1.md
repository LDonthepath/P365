# P365 Roadmap v0.1

**Status:** Active roadmap  
**Product:** P365 Market Intelligence System  
**Current implementation scope:** Macro + Crypto  
**Long-term scope:** Multi-market / cross-asset market intelligence  
**Last audited against actual codebase:** 17 Sep 2026 — see per-phase "Current Status" blocks below. Audited by reading source directly, not by trusting prior commit messages or docs.

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

**Current Status:** Confirmed complete. `lib/domain/types.ts` defines Observation/Event/Evidence/Context/State/Risk/Intelligence. `lib/domain/contracts.ts` enforces invariants (e.g. `assertStateHasEvidence`, `assertRiskHasEvidence`, `assertContextHasEvidence`, `assertIntelligenceContract` — every State/Risk/Context/Intelligence must cite evidence or it throws). `lib/domain/state.ts`, `risk.ts`, `intelligence.ts` exist as builder functions but are correctly **not imported anywhere yet** — this is expected, not dead code, since Phases 5–7 are deferred.

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

**Current Status (17 Sep 2026):**

| Domain | Status | Detail |
|---|---|---|
| Macro | ✅ COMPLETE | FRED registry and adapter cover the approved factual macro foundation, including monetary policy, liquidity, inflation, labor, rates, USD broad index, and growth series. |
| Crypto | 🟡 PARTIAL | `lib/data/crypto-market.ts` (CoinGecko). Have: BTC/ETH price, market cap, dominance, total market cap, total volume. **Missing:** stablecoin market cap and basic volatility. |
| Cross-asset | 🟡 PARTIAL | S&P 500, Nasdaq, VIX, WTI Oil, US2Y, US10Y, 10Y real yield, Gold, Russell 2000, and DXY are now implemented/covered. Gold, Russell 2000, and DXY now use Yahoo Finance (`GC=F` gold futures, `^RUT` real index — no longer the `IWM` proxy, `DX-Y.NYB` authoritative DXY). `DTWEXBGS` (FRED) remains the separate USD broad index and must not be represented as DXY. **Remaining gaps:** MOVE and credit spread coverage. |
| Evidence | ✅ COMPLETE | News and source records are normalized into Evidence with provenance and timestamps. |
| Economic events / calendar | 🟡 IMPLEMENTED / TRIAL PROVIDER | Canonical `Event` plus `EconomicEventResult` now supports actual, expected, expected type, previous, revised previous, revision, release/retrieval timestamps, source, and evidence lineage. Biquote is connected to trial ingestion and persistence. Forex Factory remains scheduled-calendar coverage. Production provider licensing remains a later activation gate. |
| Pipeline architecture | ✅ COMPLETE | Provider → Ingestion → Normalization → canonical records → persistence is implemented for the current foundation. `dashboard-query.ts` orchestrates ingestion, normalization, canonical persistence, and economic-event-result persistence. |

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

**Current Status (17 Sep 2026):**
- **Baseline: ✅ IMPLEMENTED.** `lib/domain/baseline.ts` (`buildMacroFactualBaselines`, `factualBaselineChange`) converts current-vs-prior macro observations into a display-ready comparison. Wired into the dashboard UI.
- **Market Memory: 🟡 FOUNDATION IMPLEMENTED.** Durable Supabase-backed canonical persistence is now implemented for Observation/Event/Evidence/Context, with idempotent dedupe and append-only memory controls. `EconomicEventResult` also has a dedicated durable repository. Historical retrieval, broader memory query semantics, retention/backfill, and full production E2E verification remain future work before Phase 2 can be considered complete.

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

**Current Status:** Confirmed not started. No PRE-EVENT/EVENT/POST-EVENT capture concept exists anywhere in the codebase.

### Phase 4 — Cross-Asset Context & Transmission
**Status: PARTIAL (grouping exists; transmission reasoning does not)**

Move from isolated market observations toward relationships between markets.

Questions include:

- Is a move isolated or broad?
- Which assets moved together?
- Which assets diverged?
- Did a material event transmit across markets?
- Is the observed relationship supported by comparable timestamps and evidence?

No directional conclusion should be created without an approved reasoning rule.

**Current Status:** `lib/domain/context.ts` (`buildDashboardContexts`) groups canonical observations into neutral, evidence-backed contexts — macro groups plus per-symbol crypto grouping plus an economic-events group. This is legitimate Context infrastructure (grouping only, no direction/regime inference). What's still missing: actual transmission-chain logic and validated cross-asset comparison rules.

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

**Current Status:** Confirmed deferred and respected — `lib/domain/state.ts` exists but is not part of the active pipeline. No regime logic has been implemented.

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

Completed checkpoints:

1. ✅ Audit current data paths against the Data Requirements Matrix.
2. ✅ Separate CORRECT / PARTIAL / SEMANTICALLY WRONG / DUPLICATE / MISSING / DEFERRED.
3. ✅ Implement qualified initial cross-asset coverage for Gold and Russell 2000 via Alpha Vantage, while keeping provider semantics explicit.
4. 🟡 Continue closing canonical coverage gaps: authoritative DXY, MOVE, credit spreads, stablecoin market cap, and crypto volatility.
5. 🟡 Durable Market Memory foundation is implemented; historical retrieval, backfill/retention, and broader query semantics remain before Phase 2 completion.
6. 🔴 Market Snapshot — no implementation exists.
7. 🔴 Cross-asset transmission reasoning — Context grouping exists, transmission logic does not.
8. 🟡 Economic-event result foundation is implemented for trial use; production provider qualification/licensing remains a later gate.

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

---

## 9. Known issues (as of 17 Sep 2026 audit)

Concrete, currently-true bugs — not roadmap gaps, just things that are broken right now and got reintroduced once already by an unsupervised agent session. Fix these before adding new UI surface area.

1. ✅ **Fixed (17 Sep 2026, commit `f426c0b`).** Raw English status was leaking into Indonesian UI in `app/dashboard/dashboard-view.tsx` (4 spots found on this pass, including one new one in the Intelligence tab's Provider line that didn't exist in the first fix). Reapplied via the shared `STATUS_LABEL_ID` map. If this regresses a third time, that is a strong signal the agent doing the work is not reading this file first.
2. ✅ **Fixed (17 Sep 2026, commit `f426c0b`).** The "Provider" row (Overview panel and Intelligence tab) showed the total provider count paired with the worst-case aggregate badge. Now shows a healthy/total ratio (e.g. "3/4") with a matching badge.
3. 🔴 **Still open.** `next@15.3.6` has a known security vulnerability per `npm install` output. Needs a version bump; unrelated to the agent-chaos incidents, just noted here so it isn't lost.


## 10. Cache Cadence & Invalidation Topology
**Status: CHECKPOINT 1 COMPLETE / IMPLEMENTATION PENDING**

The cache topology work standardizes Next.js fetch cache tags across all current providers while preserving each provider's existing revalidate cadence.

### Canonical cadence distribution

The FRED macro registry contains **33 series**:

| Cadence | Series count |
|---|---:|
| 6 hours | 16 |
| 12 hours | 16 |
| 24 hours | 1 |
| **Total** | **33** |

### Cache groups

| Cadence | Cache group |
|---|---|
| 5m / 15m / 30m / 1h / 6h | `p365-fast` |
| 12h | `p365-medium` |
| 24h | `p365-slow` |

`cacheTagForRevalidate()` will be the single general resolver in `lib/data/cache-policy.ts` and will be used by FRED and all non-FRED providers. No provider-specific cache-tag resolver is planned.

### Manual invalidation

The existing dashboard refresh action will remain full-dashboard refresh behavior during the initial migration, invalidating `p365-fast`, `p365-medium`, and `p365-slow`.

### Operational verification

A dedicated `p365_operational_metrics` Supabase table is planned for cache invalidation and provider-fetch telemetry. The DDL will be reviewed before execution against Supabase. `market_memory` will remain reserved for canonical market records and will not be used for operational telemetry.

### Checkpoint sequence

1. **Roadmap update** — complete.
2. **General cache policy module** — next; stop for review after implementation/diff.
3. **FRED migration** — after approval; run typecheck/build and stop for review.
4. **CoinGecko migration**.
5. **CoinDesk migration**.
6. **Alpha Vantage news migration**.
7. **Biquote / Forex Factory migration**.
8. **Gold / Russell migration**.
9. **FOMC migration**.
10. **Manual refresh action migration**.
11. **Operational telemetry implementation after DDL approval**.
12. **Audit**.
13. **Typecheck/build**.
14. **Runtime verification / final audit**.

No later checkpoint should auto-run without explicit approval after the designated stop points.

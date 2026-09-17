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

**Current Status (per domain):**

| Domain | Status | Detail |
|---|---|---|
| Macro | ✅ COMPLETE | `lib/data/macro-registry.ts` + `lib/data/fred.ts`. All P0 series present: FEDFUNDS, EFFR, WALCL, WRESBAL, M2SL, WTREGEN, SOFR, IORB, CPIAUCSL, CPILFESL, PCEPI, PCEPILFE, UNRATE, PAYEMS, ICSA, DGS2, DGS10, DFII10, DTWEXBGS, GDPC1. |
| Crypto | 🟡 PARTIAL | `lib/data/crypto-market.ts` (CoinGecko). Have: BTC/ETH price, market cap, dominance, total market cap, total volume. **Missing:** stablecoin market cap, basic volatility. |
| Cross-asset | 🟡 PARTIAL | VIX/S&P 500/Nasdaq/WTI Oil in `macro-registry.ts` (`domain: "ASSET"`). US2Y/US10Y/10Y real yield/DXY covered dual-purpose via the macro rate series. **Missing:** Gold (FRED discontinued its spot gold series — needs a different provider, e.g. Alpha Vantage `GOLD_SILVER_SPOT`), Russell 2000 (no free FRED series — needs an ETF proxy like IWM), MOVE (no free source found yet). |
| Evidence | ✅ COMPLETE | `lib/data/alpha-vantage.ts` + `lib/data/coindesk-rss.ts`, normalized via `newsToEvidence` in `lib/domain/normalize.ts`. |
| Economic events / calendar | 🔴 GAP | `lib/data/economic-calendar.ts` (ForexFactory) + `lib/data/federal-reserve-events.ts` (FOMC) fetch events, but the `CalendarEvent` type (`lib/data/types.ts`) has **no `actual`/`expected`/`previous` fields**. This blocks the reasoning flow's second step ("Detect Change / Surprise" in Section 4) for every scheduled release — the data literally cannot answer "was this a surprise?" yet. |
| Pipeline architecture | ✅ NEW | A clean Provider→Ingestion→Normalization boundary now exists: `lib/ingestion/dashboard-ingestion.ts`, `lib/normalization/dashboard-normalization.ts`, `lib/application/dashboard-query.ts` orchestrates both. Matches this doc's Section 3 flow by name. |

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

**Current Status:** Mixed — one real gap looks solved but isn't yet.
- **Baseline: ✅ IMPLEMENTED.** `lib/domain/baseline.ts` (`buildMacroFactualBaselines`, `factualBaselineChange`) + `lib/presentation/baseline.ts` convert current-vs-prior macro observations into a display-ready comparison. Wired into the dashboard UI (`OverviewWhatChanged`).
- **Market Memory: 🔴 SHAPE EXISTS, FUNCTIONALLY A NO-OP.** `lib/repositories/{types,memory,dashboard-repository}.ts` define a clean, swappable repository interface (`ObservationRepository`, `EventRepository`, `EvidenceRepository`, `ContextRepository`) and an in-memory adapter, wired via `persistCanonicalDashboardData` in `lib/application/dashboard-query.ts`. Two problems make this non-functional today: (1) storage is a plain `Map` held in server memory — not durable across serverless cold starts/redeploys; (2) `.findById()` is **never called anywhere in the codebase** — data is written every request and never read back. This is write-only, dead-end persistence. The interface design is reusable and worth keeping; a real backend still needs to be plugged in before Phase 2 can be called done. (A Supabase-backed implementation was attempted and removed on 16 Sep 2026 for being premature/unreviewed — the removal was about process, not concept; a durable backend is still the right eventual answer here.)

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

**Current Status:** `lib/domain/context.ts` (`buildDashboardContexts`) groups canonical observations into neutral, evidence-backed contexts — 7 macro groups (monetary policy, liquidity, inflation, labor, rates, USD, growth) plus per-symbol crypto grouping plus an economic-events group. This is legitimate, correctly-scoped Context infrastructure (grouping only, no direction/regime inference, matching this section's own constraint). What's still missing: any actual transmission-chain logic (e.g. yield → DXY → gold → crypto sequencing) and it is currently blocked by the Phase 1 gold-data gap.

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

**Current Status:** Confirmed deferred and respected — `lib/domain/state.ts` exists (builder + confidence rules) but is imported nowhere outside `lib/domain/`. No regime logic has been implemented anywhere in the pipeline.

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

1. ✅ **Done (16 Sep 2026).** Audit current data paths against the Data Requirements Matrix.
2. ✅ **Done.** Separated CORRECT / PARTIAL / SEMANTICALLY WRONG / DUPLICATE / MISSING / DEFERRED — see Phase 1 table above.
3. 🟡 **Partially done.** Qualified providers identified for VIX/S&P/Nasdaq/Oil (FRED, done) and gold/Russell (Alpha Vantage, identified but not yet implemented).
4. 🔴 **Not done.** Canonical observation coverage still has gaps: gold, Russell 2000, MOVE, stablecoin market cap, crypto volatility, and calendar actual/expected/previous fields (see Phase 1 table).
5. 🟡 **Partially done, needs rework.** Baseline is real; Market Memory is a non-functional stub (see Phase 2 status) — needs a durable backend before this checkpoint is actually complete.
6. 🔴 **Not done.** Market Snapshot — no implementation exists.
7. 🔴 **Not started.** Cross-asset reasoning — grouping infrastructure exists (Phase 4), transmission logic does not.

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

1. **Raw English status leaked into Indonesian UI.** `app/dashboard/dashboard-view.tsx` interpolates `{marketStatus}` directly in at least 2 places (Overview "OBSERVASI", Intelligence tab) instead of translating it through a label map. This was fixed once (a `STATUS_LABEL_ID` map) and got overwritten during the 15–17 Sep unsupervised sessions.
2. **"Provider" row in the Overview "Cakupan data" panel is semantically mismatched.** It shows the total provider count paired with the worst-case aggregate status badge (e.g. "4 — TIDAK TERSEDIA" when only 1 of 4 providers is actually down). This was fixed once (shown as a healthy/total ratio, e.g. "3/4") and also got overwritten.
3. **`next@15.3.6` has a known security vulnerability** per `npm install` output. Needs a version bump; unrelated to the agent-chaos incidents, just noted here so it isn't lost.

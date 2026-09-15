# P365 Architecture v0.4

## Product boundary

P365 is a private market-intelligence dashboard. The current implementation scope is **Macro + Crypto**. The domain contracts remain market-agnostic so other markets can be added later without changing the core model.

P365 is not a trading bot, execution system, signal copier, or price predictor.

P365 exists to **explain the market, not merely to display it**. The intended user-facing output is a Market Briefing that explains what changed, why it matters, how expectations and pricing changed, how the move transmitted across assets, what confirms or contradicts the interpretation, and what should be monitored next.

## Core domain

- Observation: a fact or measurable item observed from a source.
- Event: a time-bound occurrence, scheduled or unscheduled.
- Context: an explicit grouping of related canonical observations/events. Context does not infer market direction.
- Baseline: a validated reference used to answer a specific comparison question.
- Market Snapshot: an immutable, time-indexed representation of the market information relevant to a defined scope at capture time.
- Market Memory: time-indexed references to prior canonical objects and Snapshots used to evaluate change. It is not a second source of truth.
- State: an interpreted condition at a point in time, with confidence and evidence.
- Risk: uncertainty or adverse-condition context that matters to decision support.
- Intelligence: evidence-based interpretation with explicit confirmation, contradiction, invalidation, and monitoring criteria.
- Briefing: human-readable synthesis of canonical intelligence; it must not invent new facts.

Regime, sentiment, liquidity-flow, capital-flow, and portfolio/trading models remain deferred until their definitions and evidence requirements are established.

## Market reasoning model

P365 should reason about **change relative to context**, not isolated values.

```text
Observe
  ↓
Compare with appropriate Baseline
  ↓
Detect Change / Surprise
  ↓
Detect Repricing
  ↓
Test Cross-Asset Transmission
  ↓
Resolve Confirmation / Contradiction
  ↓
Explain Regime
  ↓
Market Briefing
```

A single universal baseline is insufficient. P365 should distinguish:

```text
FACTUAL BASELINE       → what was true before?
EXPECTATION BASELINE   → what was expected?
PRICING BASELINE       → what was already priced?
REGIME BASELINE        → under what environment did the market operate?
HISTORICAL BASELINE    → is the change unusual?
```

For example, an economic release can be above consensus while still producing little incremental market surprise if the result was already embedded in market pricing.

See [`docs/P365-MARKET-REASONING-BASELINE-v0.1.md`](P365-MARKET-REASONING-BASELINE-v0.1.md) for the conceptual baseline contract and [`docs/P365-MARKET-SNAPSHOT-CONTRACT-v0.1.md`](P365-MARKET-SNAPSHOT-CONTRACT-v0.1.md) for the immutable snapshot model.

## Data flow

```text
Provider
  ↓
Ingestion
  ↓
Normalization
  ↓
Canonical Observation / Event / Evidence
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

## Market Snapshot principle

A Snapshot records **what was observable at capture time**. It must never be retroactively rewritten using information learned later.

For event analysis, the conceptual sequence is:

```text
PRE-EVENT SNAPSHOT
        ↓
EVENT / RELEASE
        ↓
POST-EVENT SNAPSHOT
        ↓
CHANGE / SURPRISE / REPRICING
        ↓
CROSS-ASSET TRANSMISSION TEST
```

Snapshots reference canonical observations/events and preserve their provenance. They are not a second source of truth and do not contain hidden directional conclusions.

## Context Layer v0.2

Context is a **neutral relationship/grouping layer**. It establishes which canonical facts belong together so a later reasoning layer has a stable, traceable input.

Current Context scopes:

```text
CRYPTO MARKET
├── BTC observations
├── ETH observations
└── future crypto assets can be added without changing the Context contract

MACRO
├── Monetary Policy  : FEDFUNDS, EFFR, WALCL, WRESBAL
├── Liquidity        : M2SL, WTREGEN, RRPONTSYD
├── Inflation        : CPIAUCSL, CPILFESL, PCEPI, PCEPILFE
├── Labor            : UNRATE, PAYEMS, ICSA
├── Rates            : DGS2, DGS10, DFII10
├── USD              : DTWEXBGS
└── Growth            : GDPC1

ECONOMIC EVENTS
└── canonical calendar + official FOMC events
```

Macro grouping is driven by canonical FRED `seriesId` metadata and the locked Macro Series Registry, rather than by interpretation or subject-string matching. The current registry contains 19 P0 macro series across the scopes above.

Crypto grouping is based on the canonical market observation domain and asset metadata. BTC and ETH are therefore **assets inside Crypto Market**, not separate top-level domains.

Context must:

1. reference at least one observation or event;
2. remain traceable to canonical IDs;
3. preserve the distinction between observations and events;
4. avoid inferring direction, regime, sentiment, liquidity flow, capital flow, or risk;
5. never convert missing provider data into a fabricated context.

The canonical macro observations preserve `seriesId`, frequency, unit, observation date, previous value, and source metadata, providing the factual basis for Context grouping.

## Canonical Observation Pipeline v0.1

The current crypto market source provides BTC/USD and ETH/USD spot-rate observations. FRED provides the structured macro observation foundation. Each canonical observation is linked to Evidence. The normalization layer preserves the observation date separately from the P365 capture time.

News remains Evidence and is not silently promoted into Observation. Economic-calendar and FOMC records remain Events with linked Evidence.

## Invariants

1. Observation must not contain interpretation.
2. Context must be traceable to observations/events.
3. Context must contain at least one observation or event.
4. Provider failure must remain distinguishable from an ordinary empty result.
5. State requires timestamp and confidence.
6. Briefing must not invent new facts.
7. UI must not own domain reasoning.
8. Provider-specific response shapes must not leak into the domain layer.
9. Every canonical observation produced by the current pipeline has linked Evidence.
10. News is not silently promoted into Observation.
11. Intelligence must remain traceable to canonical evidence and explicit reasoning fields.
12. Baselines must have a defined comparison purpose, timestamp, provenance, and quality.
13. Missing or stale baselines must remain explicit uncertainty.
14. Market Memory must not replace canonical observations/events as the source of truth.
15. Different baseline types must not be collapsed into one generic delta.
16. Market Snapshots are immutable after creation.
17. Historical Snapshots must not be rewritten using later information.
18. Snapshot comparisons must respect temporal, semantic, unit, and quality compatibility.

## Current implementation

`getDashboardData()` exposes canonical observations, events, contexts, evidence, and provider health while preserving the existing UI-compatible news/calendar fields. Context is wired into the dashboard and rendered as a dedicated neutral context list.

The current Context implementation is deliberately mechanical. It is not a State engine and must not be used as one. Baseline, Market Memory, and Market Snapshot are currently **design-level reasoning infrastructure**, not implemented engines.

## Roadmap: Context → Baseline/Memory → Snapshot → State → Risk → Intelligence → Briefing

**Process rule:** one stage = one isolated change/checkpoint. Do not implement multiple reasoning stages in a single pass.

1. **Context** — complete v0.2 grouping and traceability foundation. **Current foundation checkpoint.**
2. **Baseline / Market Memory** — define validated comparison references and temporal memory without creating a second source of truth.
3. **Market Snapshot** — implement immutable capture-time market state references for before/after and historical comparison.
4. **State** — define concrete confidence/domain rules for at least one case and wire one panel only.
5. **Risk** — derive Risk from State plus relevant upcoming events.
6. **Intelligence** — synthesize Context + Baseline/Memory + Snapshot + State + Risk into WHAT/WHY/CONFIRMS/CONTRADICTS/INVALIDATES/MONITOR.
7. **Briefing** — render human-readable market synthesis from canonical intelligence without inventing facts.

Each stage requires its own verification and a short note explaining the chosen domain rule. Domain reasoning must be established before it is encoded.

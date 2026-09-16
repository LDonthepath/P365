# P365 Architecture

P365 is a market-intelligence system designed to explain observable market conditions through a traceable sequence from canonical data to intelligence. The architecture is market-agnostic; Macro + Crypto are current implementation domains, not the product boundary.

## Reasoning boundary

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

The UI must remain a presentation layer. Domain reasoning belongs in the domain/data layers and must remain traceable to canonical evidence.

## Macro factual foundation

```text
MACRO
├── Monetary Policy : FEDFUNDS, EFFR, WALCL, WRESBAL
├── Liquidity       : M2SL, WTREGEN, RRPONTSYD
├── Inflation       : CPIAUCSL, CPILFESL, PCEPI, PCEPILFE
├── Labor           : UNRATE, PAYEMS, ICSA
├── Rates           : DGS2, DGS10, DFII10
├── USD             : DTWEXBGS
└── Growth          : GDPC1

ASSET / CROSS-ASSET FOUNDATION
├── VIXCLS
├── SP500
├── NASDAQCOM
└── DCOILWTICO

ECONOMIC EVENTS
└── canonical calendar + official FOMC events
```

Macro grouping is driven by canonical FRED `seriesId` metadata and the Macro Series Registry rather than by interpretation or subject-string matching.

Context must:

1. reference at least one observation or event;
2. remain traceable to canonical IDs;
3. preserve the distinction between observations and events;
4. avoid inferring direction, regime, sentiment, liquidity flow, capital flow, or risk;
5. never convert missing provider data into a fabricated context.

## Canonical Observation Pipeline

FRED provides structured macro observations. Each canonical observation is linked to Evidence. The normalization layer preserves the observation date separately from the P365 retrieval/capture time.

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

`getDashboardData()` exposes canonical observations, events, contexts, evidence, provider health, and factual macro baselines while preserving the existing UI-compatible news/calendar fields.

The Context implementation is deliberately mechanical and does not act as a State engine. The first Baseline implementation is now wired: `buildMacroFactualBaselines()` selects the latest compatible canonical observation and its preceding observation per macro series, preserving quality and evidence lineage. It calculates only the factual delta; it does not assign direction, abnormality, surprise, repricing, or regime.

## Roadmap: Context → Baseline/Memory → Snapshot → State → Risk → Intelligence → Briefing

**Process rule:** one stage = one isolated change/checkpoint. Do not implement multiple reasoning stages in a single pass.

1. **Context** — complete v0.2 grouping and traceability foundation. **Complete foundation.**
2. **Baseline / Market Memory** — factual baseline selection is now wired for macro series; expectation, pricing, historical-abnormality baselines and full memory comparison remain pending.
3. **Market Snapshot** — implement immutable capture-time market state references for before/after and historical comparison.
4. **State** — define concrete confidence/domain rules for at least one case and wire one panel only.
5. **Risk** — derive Risk from State plus relevant upcoming events.
6. **Intelligence** — synthesize Context + Baseline/Memory + Snapshot + State + Risk into WHAT/WHY/CONFIRMS/CONTRADICTS/INVALIDATES/MONITOR.
7. **Briefing** — render human-readable market synthesis from canonical intelligence without inventing facts.

Each stage requires its own verification and a short note explaining the chosen domain rule. Domain reasoning must be established before it is encoded.

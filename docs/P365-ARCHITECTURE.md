# P365 Architecture

P365 is a Financial Market Intelligence System designed to explain observable market conditions through a traceable sequence from canonical data to intelligence. The architecture is market-agnostic and multi-asset; the current Macro + Crypto + selected cross-asset implementation is only a foundation subset, not the product boundary.

The normative semantic map for market domains, information classes, jurisdiction, instrument, participant, tenor/horizon, and methodology/provenance is `P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md`.

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

## Financial-market semantic model

The provider pipeline remains generic, but canonical semantics must not rely on the current coarse `MARKET / MACRO / ASSET / OTHER` classification forever.

Target semantics are multidimensional:

```text
Market Domain
+ Information Class
+ Jurisdiction
+ Instrument
+ Participant (where relevant)
+ Tenor / Horizon
+ Methodology / Provenance
```

Examples:

```text
US 10Y Treasury      → RATES / PRICING / US / SOVEREIGN_BOND / 10Y
10Y-2Y spread        → RATES / DERIVED_METRIC / US
CPI actual           → ECONOMY / OBSERVATION / US
CPI consensus        → ECONOMY / EXPECTATION / US
FOMC Dot Plot        → POLICY / EXPECTATION / US
BTC ETF net flow     → CRYPTO / FLOW / ETF
COT leveraged money  → POSITIONING semantics through domain + information-class dimensions
Term premium         → RATES / MODEL_ESTIMATE
Risk Appetite State  → DERIVED_STATE
```

This ontology is additive. Existing stored records and append-only Market Memory must not be rewritten merely to fit the new classification.


## Current implementation subset

The current FRED registry is broader than the original Macro-only foundation and includes 33 series across policy, liquidity/funding, economy, rates, FX, credit, equity, volatility, and commodity semantics.

```text
CURRENT FRED REGISTRY

Policy / implementation
├── FEDFUNDS
├── EFFR
├── WALCL
├── WRESBAL
└── IORB

Liquidity / funding / fiscal
├── M2SL
├── WTREGEN
├── SOFR
└── RRPONTSYD

Economy
├── CPIAUCSL / CPILFESL
├── PCEPI / PCEPILFE
├── UNRATE / PAYEMS
├── ICSA / CCSA
├── JTSJOL / JTSQUR
├── SAHMREALTIME
└── GDPC1

Rates / inflation pricing / credit / FX
├── DGS2 / DGS10
├── DFII10
├── T10YIE
├── T10Y2Y
├── BAMLC0A0CM
├── BAMLH0A0HYM2
└── DTWEXBGS

Cross-asset prices
├── VIXCLS
├── SP500
├── NASDAQCOM
└── DCOILWTICO
```

Yahoo adds Gold futures, Russell 2000, and DXY; CoinGecko adds BTC/ETH and crypto-wide market observations; Biquote adds trial economic-event result data.

The current runtime still stores these through legacy `ObservationDomain` categories. The ontology document defines their target semantic mapping without authorizing a runtime migration in this checkpoint.

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

## Foundation sequencing

**Process rule:** one logical checkpoint = one PR. Do not combine ontology migration, provider expansion, and higher-order reasoning in one change.

```text
Financial Market Ontology documentation
        ↓
Additive semantic-dimensions compatibility contract
        ↓
Independent ingestion / backfill ownership
        ↓
Repository-backed factual baseline
        ↓
Temporal / provenance / freshness / identity hardening
        ↓
Current foundation defect closure
        ↓
Core market-universe expansion
        ↓
Expectation baseline
        ↓
Pricing baseline
        ↓
Immutable Market Snapshot
        ↓
Event-window repricing / transmission
        ↓
Secondary positioning / flow / internals
        ↓
Derived State → Intelligence → Briefing
```

State, Risk, Regime, Intelligence, and Briefing remain downstream of factual/history/baseline/snapshot gates. The financial-market ontology broadens what P365 can represent; it does not authorize premature interpretation.

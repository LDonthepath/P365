# P365 Architecture

P365 is a Financial Market Intelligence System designed to explain observable market conditions through a traceable sequence from canonical data to intelligence. The architecture is market-agnostic and future-compatible with a broader multi-asset universe, while the **first MVP acceptance boundary is standalone Macro Catalyst & Narrative Intelligence**. Existing Crypto/Gold code remains valid, but is **not a prerequisite** of the first macro MVP.

The normative semantic map for market domains, information classes, jurisdiction, instrument, participant, tenor/horizon, and methodology/provenance is `P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md`.

**Authority (14 October 2026):** [Product/Decision-Support Contract](P365-USER-DECISION-SUPPORT-CONTRACT.md) defines current MVP acceptance, [Ontology](P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md) defines semantics, [Recovery #283](https://github.com/LDonthepath/P365/issues/283) tracks engineering, and [Product #360](https://github.com/LDonthepath/P365/issues/360) tracks product gates. This document describes architecture, not a verified claim that every component is implemented.

For the **first MVP**:
- Compare qualified macro facts (growth, inflation, labor, policy, rates, macro liquidity/funding) against temporally valid predecessors, historical distributions and/or qualified expectations.
- Identify **candidate macro catalysts** (not fabricated scheduled Events) and compose original evidence-linked macro narratives with support, contradictions, uncertainty and what to monitor.
- The narrative must be useful **without BTC/Gold market prices, MOVE, cross-asset attribution or market risk-on/off**.
- Keep cross-asset explanation, regime engines, derived State/Risk/Intelligence and trading logic behind independent owner-approved gates. Existing Crypto/Gold capability contracts are preserved as later-phase work.

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

The diagram is a **target capability map**, not the mandatory MVP execution chain: macro briefing may consume qualified macro observations, baselines and evidence without State, market repricing, cross-asset transmission or derived market regime. The UI must remain a presentation layer. Domain reasoning belongs in the domain/data layers and must remain traceable to canonical evidence.

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

Current canonical Observation writes now carry optional versioned `semantics` with market domain, information class, and relevant jurisdiction/instrument/asset/participant/tenor dimensions. Legacy `domain` remains unchanged for compatibility, and historical rows without `semantics` can be resolved from approved `seriesId`/`metricId` mappings without mutation. See `P365-CANONICAL-SEMANTIC-DIMENSIONS-COMPATIBILITY-v0.1.md`.


## Current implementation subset

As verified at `main@0ee4d3cd` (14 October 2026), `lib/data/macro-registry.ts` contains **37 FRED series** across macro and supporting cross-asset categories. The code registry is authoritative for series IDs; a registered series is **not** proof of complete durable history, publication-time qualification or production freshness.

```text
FRED REGISTRY AT main@0ee4d3cd — 37 SERIES

Policy / central-bank balance sheets
├── FEDFUNDS / EFFR / IORB
├── WALCL / WRESBAL
└── ECBASSETSW / JPNASSETS

Liquidity / funding / fiscal
├── M2SL / WTREGEN
└── SOFR / RRPONTSYD

Economic activity / prices / labor
├── CPIAUCSL / CPILFESL / PCEPI / PCEPILFE
├── UNRATE / PAYEMS / ICSA / CCSA
├── JTSJOL / JTSQUR / SAHMREALTIME
└── GDPC1

Rates / inflation pricing / financial conditions / credit / FX
├── DGS2 / DGS10 / DFII10 / T10YIE / T10Y2Y
├── NFCI / ANFCI
├── BAMLC0A0CM / BAMLH0A0HYM2
└── DTWEXBGS

Supporting cross-asset observations
└── VIXCLS / SP500 / NASDAQCOM / DCOILWTICO
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
First MVP: macro change → candidate catalysts → evidence-linked macro narrative
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

Derived State, Risk, Regime and higher-order cross-asset Intelligence remain behind separate approved factual/history/baseline/calibration gates; **macro-only evidence-linked briefing is the first MVP target** and does not depend on completing BTC/Gold or event-window pipelines. The financial-market ontology broadens what P365 can represent; it does not authorize premature interpretation.

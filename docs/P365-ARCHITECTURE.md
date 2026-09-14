# P365 Architecture v0.1

## Product boundary

P365 is a private market-intelligence dashboard. The current product collects macro news, crypto news, crypto market observations, and economic-calendar events and prepares them for progressively richer context and intelligence layers.

The current implementation scope is **Macro + Crypto**. The domain contracts remain market-agnostic so other markets can be added later without changing the core model.

## Core domain

- Observation: a fact or measurable item observed from a source.
- Event: a time-bound occurrence, scheduled or unscheduled.
- Context: a relationship between observations/events that gives them meaning.
- State: an interpreted condition at a point in time, with confidence and evidence.
- Risk: uncertainty or adverse-condition context that matters to decision support.
- Intelligence: evidence-based interpretation with explicit confirmation, contradiction, invalidation, and monitoring criteria.

## Supporting concepts

- Source: origin of data.
- News: a source format, not intelligence by itself.
- Briefing: presentation/application output derived from intelligence.

Regime, sentiment, liquidity, and capital-flow models are intentionally deferred until their definitions and evidence requirements are established.

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
State / Risk
  ↓
Intelligence
  ↓
Briefing
  ↓
UI
```

## Canonical Observation Pipeline v0.1

`lib/data/crypto-market.ts` provides a structured BTC/USD and ETH/USD spot-rate observation source through Alpha Vantage's exchange-rate endpoint.

The pipeline creates two linked domain objects:

1. `Observation` — the measurable value, timestamp, domain, and source.
2. `Evidence` — the captured source record backing that observation.

The observation is therefore never created from a news headline or from an interpretation. Its `value` remains a raw observed measurement represented as a string at the domain boundary.

### Current coverage

- Crypto: BTC/USD spot rate — supported when Alpha Vantage is configured and returns a valid rate.
- Crypto: ETH/USD spot rate — supported under the same condition.
- Macro: structured macro observations — **not yet available** from the current provider set; macro news remains Evidence only.
- Economic calendar: Event only; it is not converted into an Observation.

This limitation is intentional. P365 must not fabricate macro observations from narrative news or calendar metadata.

## Invariants

1. Intelligence must have evidence.
2. Observation must not contain interpretation.
3. Provider failure must not be represented as an ordinary empty result at the domain layer.
4. State requires timestamp and confidence.
5. Briefing must not invent new facts.
6. Context must be traceable to observations/events.
7. UI must not own domain reasoning.
8. Provider-specific response shapes must not leak into the domain layer.
9. Every canonical observation produced by the current market pipeline has linked Evidence.
10. News is not silently promoted into Observation.

## v0.1 implementation

The existing provider functions remain the ingestion boundary. `lib/domain/` provides canonical domain types and normalization helpers without forcing a UI rewrite.

Current canonical outputs exposed by `getDashboardData()`:

- `observations`
- `events`
- `evidence`
- `providerHealth`

Existing `macroNews`, `cryptoNews`, and `calendarEvents` are preserved for UI compatibility.

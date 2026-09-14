# P365 Architecture v0.1

## Product boundary

P365 is a private market-intelligence dashboard. The current product collects macro news, crypto news, and economic-calendar events and prepares them for progressively richer context and intelligence layers.

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
Source -> Ingestion -> Normalization -> Observation/Event -> Context -> State/Risk -> Intelligence -> Briefing -> UI
```

## Invariants

1. Intelligence must have evidence.
2. Observation must not contain interpretation.
3. Provider failure must not be represented as an ordinary empty result at the domain layer.
4. State requires timestamp and confidence.
5. Briefing must not invent new facts.
6. Context must be traceable to observations/events.
7. UI must not own domain reasoning.
8. Provider-specific response shapes must not leak into the domain layer.

## v0.1 implementation

The existing provider functions remain the ingestion boundary. `lib/domain/` now provides canonical domain types and normalization helpers without forcing a UI rewrite.

Current canonical outputs exposed by `getDashboardData()`:

- `observations`
- `events`
- `providerHealth`

Existing `macroNews`, `cryptoNews`, and `calendarEvents` are preserved for UI compatibility.

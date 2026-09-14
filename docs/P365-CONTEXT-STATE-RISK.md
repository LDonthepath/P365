# P365 Context → State → Risk v0.1

## Purpose

This layer turns canonical observations and scheduled events into explicit context, interpreted state, and risk. It does not predict price and does not create trading signals.

## Contract

```text
Observation / Event
        ↓
      Context
        ↓
       State
        ↓
       Risk
        ↓
   Intelligence
```

### Context

Context describes relationships between known observations and events. It must retain the IDs of the facts/events that support the statement.

### State

State is an interpreted condition at a point in time. A state must carry confidence and evidence IDs.

- `CONFIRMED`: all supplied observations are fresh.
- `LEANING`: evidence exists but quality is mixed.
- `PENDING`: no evidence or stale evidence prevents a reliable interpretation.

### Risk

Risk describes uncertainty or exposure implied by the current context/state. Risk is not a trade signal.

- `LOW`
- `MEDIUM`
- `HIGH`
- `UNKNOWN`

Every risk object must retain evidence IDs.

## Invariants

1. No State without evidence.
2. No Risk without evidence.
3. Event ≠ Observation. A scheduled event is not treated as a measured fact.
4. Context does not invent facts; it references observations/events.
5. Confidence expresses evidence quality, not certainty about future price.
6. UI remains a view over the domain; it does not calculate state or risk.

## Deferred

Regime, liquidity, capital flow, sentiment, cluster rotation, and portfolio/trading engines remain outside this slice. They can consume State/Risk later without changing the canonical evidence model.

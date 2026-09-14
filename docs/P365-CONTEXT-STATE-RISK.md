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

Context describes relationships between known observations and events. It must retain the IDs of the facts/events that support the statement. A context with no observation or event is invalid.

### State

State is an interpreted condition at a point in time. A state must carry confidence and evidence IDs. The builder rejects a state with no linked evidence.

- `CONFIRMED`: all supplied observations are fresh.
- `LEANING`: evidence exists but quality is mixed (`PARTIAL`).
- `PENDING`: no evidence, stale evidence, or unknown-quality evidence prevents a reliable interpretation.

An explicitly supplied confidence value does not remove the requirement for evidence; callers are responsible for using it only when consistent with the evidence quality.

### Risk

Risk describes uncertainty or exposure implied by the current context/state. Risk is not a trade signal. The builder rejects a risk with no linked evidence.

- `LOW`
- `MEDIUM`
- `HIGH`
- `UNKNOWN`

Every risk object must retain evidence IDs.

## Invariants

1. No Context without at least one observation or event.
2. No State without evidence.
3. No Risk without evidence.
4. Event ≠ Observation. A scheduled event is not treated as a measured fact.
5. Context does not invent facts; it references observations/events.
6. Confidence expresses evidence quality, not certainty about future price.
7. `UNKNOWN` or `STALE` observation quality cannot produce `CONFIRMED` state confidence.
8. UI remains a view over the domain; it does not calculate state or risk.

## Audit result after Canonical Observation Pipeline v0.1

The canonical Observation pipeline now supplies measurable crypto facts to downstream layers. The Context → State → Risk audit therefore focuses on contract enforcement rather than inventing a market interpretation. No generic state or risk is generated merely because observations exist; a future intelligence layer must define the meaning of each state/risk value and its evidence requirements.

## Deferred

Regime, liquidity, capital flow, sentiment, cluster rotation, and portfolio/trading engines remain outside this slice. They can consume State/Risk later without changing the canonical evidence model.

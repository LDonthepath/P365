# P365 Context → State → Risk Audit v0.2

## Audit target

Audit the Context → State → Risk contract after canonical crypto Observations, macro Observations, and calendar Events became available.

## Verified findings

1. Canonical Observation objects exist for measurable crypto and macro facts.
2. Context builder rejects an empty context and preserves observation/event IDs.
3. State builder rejects zero-evidence states and prevents explicitly `CONFIRMED` states when supplied observations are stale or unknown-quality.
4. Risk builder rejects zero-evidence risks.
5. No generic market State/Risk is generated merely because observations exist. Domain meaning and thresholds remain intentionally undefined.
6. Contract hardening now rejects empty or duplicate observation/event/evidence IDs in Context, State, and Risk references.
7. Intelligence evidence IDs must be non-empty and unique; `CONFIRMS` and `CONTRADICTS` references must also be present in the Intelligence `evidenceIds` set and cannot duplicate one another.
8. These contract checks remain semantic/traceability guards only. They do not create market interpretations or trading signals.

## Architectural conclusion

The Context → State → Risk layer is currently a **contract and neutral grouping layer**, not yet a market interpretation engine.

Context v0.2 is the current implementation checkpoint. State and Risk builders exist as validated domain primitives, but no domain-specific State/Risk engine is wired into the dashboard.

The next reasoning work must define the semantic meaning of states and risks from verified evidence before adding domain-specific labels, thresholds, or formulas.

## Out of scope

- Regime Engine
- LDS / liquidity models
- Capital Flow
- Sentiment
- Cluster Rotation
- trading/execution logic
- price prediction

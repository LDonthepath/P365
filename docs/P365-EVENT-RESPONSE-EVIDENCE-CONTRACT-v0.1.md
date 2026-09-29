# P365 Integrated Event Response Evidence Contract v0.1

**Checkpoint:** EVR-001  
**Status:** PR #77 open; owner review/merge required  
**Scope:** Read-only integration of SUR-001, RPR-001 and TRN-001 for one qualified post-event knowledge state  
**Prerequisites:** SUR-001, RPR-001, TRN-001, CMP-001, EVW-001

## Purpose

EVR-001 binds the already-governed event evidence layers into one auditable chain:

```text
Qualified Event Window
        ↓
SUR-001 factual actual-vs-expectation
        ↓
CMP-001 PRE → post comparison
        ↓
RPR-001 explicit-threshold repricing
        ↓
TRN-001 explicit-methodology cross-asset response coherence
        ↓
EVR-001 integrated evidence bundle
```

It does not add another interpretation layer. Its purpose is lineage integrity.

## Shared knowledge state

The bundle requires all component outputs to refer to:

- the same provider-independent `eventIdentityKey`;
- the same EVW-001 `windowId` for RPR/TRN;
- the same post-event role for RPR/TRN;
- the same CMP-001 lineage for RPR/TRN;
- one shared post-event knowledge cutoff.

For repository-backed execution, EVR-001 owns the SUR-001 request as:

```text
eventIdentityKey = window.eventIdentityKey
releaseAt        = window.t0
asOf             = after.capturedAt
```

Therefore factual actual/expectation evidence and market-response evidence are evaluated at the same point-in-time boundary.

## Caller-owned policy remains caller-owned

EVR-001 does not define:

- an expectation provider;
- FORECAST vs CONSENSUS vs OFFICIAL_PROJECTION preference;
- RPR-001 repricing thresholds;
- TRN-001 driver/response pairs;
- expected SAME_DIRECTION / OPPOSITE_DIRECTION relationships;
- materiality;
- causality.

Those inputs remain explicit.

## Output

The deterministic bundle retains:

- SUR-001 assessment and ID;
- RPR-001 assessment and ID;
- TRN-001 assessment and ID;
- Event identity;
- Event Window identity;
- post-event role;
- shared `knowledgeAt`;
- `causalAttribution = NOT_EVALUATED`.

The bundle has no aggregate bullish/bearish, hawkish/dovish, risk-on/risk-off, confidence, State, Regime, Risk, or Intelligence label.

Missing, partial, unresolved, contaminated, or divergent component evidence remains visible in the original component assessment rather than being flattened into a new conclusion.

## Determinism

Equivalent component assessments and lineage produce the same:

```text
event-response-evidence-v1-<hash>
```

identity.

## Acceptance criteria

EVR-001 v0.1 passes when:

1. SUR-001, RPR-001 and TRN-001 are reused rather than reimplemented;
2. one provider-independent Event identity is enforced across all components;
3. SUR-001 `asOf` exactly equals the post-event Snapshot `capturedAt`;
4. RPR/TRN share Event Window, post-event role and CMP lineage;
5. TRN references the exact supplied RPR assessment;
6. all component causality remains `NOT_EVALUATED`;
7. caller-owned thresholds, expectation semantics and relationship rules remain explicit;
8. deterministic identity is regression-covered;
9. no persistence runtime, provider expansion, State/Risk/Regime/Intelligence, UI, signal, sizing or execution logic is activated;
10. build/lint pass before owner merge.

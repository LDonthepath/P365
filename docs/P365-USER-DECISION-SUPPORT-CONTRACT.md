# P365 — User & Decision-Support Contract

**Status:** Product constraint  
**Primary user:** Self-directed retail trader and investor  
**Product:** P365 Market Intelligence System

## 1. Purpose

P365 is built for a self-directed retail trader and investor who makes their own market, trading, and investment decisions.

The system must provide professional-grade market understanding without requiring institutional infrastructure or forcing the user to reconstruct the market narrative from disconnected indicators, headlines, and charts.

P365 remains a **Market Intelligence System**, not an advisory or execution system.

## 2. User outcome

P365 should help the user answer, in order:

1. What happened?
2. What changed relative to the correct baseline?
3. Was the change different from expectations?
4. Did market pricing actually reprice?
5. Did the response transmit across relevant assets?
6. What evidence confirms the interpretation?
7. What evidence contradicts it?
8. What market state/regime context is relevant?
9. What could invalidate the current interpretation?
10. What should be monitored next?

The system supports the user's decision process. The decision itself remains with the user.

## 3. Product boundary

P365 must not collapse intelligence into prescriptive outputs such as:

- BUY / SELL instructions;
- LONG / SHORT signals;
- automatic trade execution;
- portfolio allocation instructions;
- position sizing recommendations;
- price predictions presented as decisions.

Instead, P365 should expose the factual and reasoning chain needed for the user to form their own thesis.

## 4. Engineering implications

Every feature should pass two independent gates:

### Architecture gate
- Uses canonical contracts and preserves provenance.
- Respects temporal semantics.
- Keeps provider-specific shapes outside the domain layer.
- Keeps reasoning outside the UI.
- Does not fabricate missing data, baselines, or conclusions.
- Remains compatible with the market-agnostic architecture.

### User-value gate
The feature must materially improve at least one of:
- situational awareness;
- comparison against an appropriate baseline;
- expectation/surprise understanding;
- repricing detection;
- cross-asset transmission analysis;
- confirmation/contradiction resolution;
- regime/context understanding;
- evidence traceability;
- monitoring of invalidation or next relevant developments.

A feature that only adds more metrics, cards, indicators, or visual complexity without improving market understanding is not sufficient product value by itself.

## 5. Information hierarchy

The eventual user experience should optimize for progressive disclosure:

```text
Market Briefing / Important Changes
  ↓
Reasoning & Context
  ↓
Confirmation / Contradiction / Invalidation / Monitor
  ↓
Evidence & Baselines
  ↓
Canonical Observations / Raw Detail
```

Professional depth should remain available, but the user should not have to manually inspect dozens of unrelated indicators before understanding what changed and why it matters.

## 6. Relationship to existing reasoning model

This contract does not replace the canonical P365 reasoning model:

```text
Observe
  ↓
Compare
  ↓
Detect Surprise
  ↓
Detect Repricing
  ↓
Test Transmission
  ↓
Resolve Confirmation / Contradiction
  ↓
Explain Regime
  ↓
Market Briefing
```

It defines **who that reasoning serves and what constitutes useful product output**.

All existing sequencing gates remain in force. This document does not authorize premature State, Risk, Intelligence, Regime, signal, execution, or portfolio logic.

## 7. Product test

Before approving a meaningful product feature, ask:

> Does this make it easier for a self-directed retail trader/investor to understand the market and form their own evidence-based decision, without P365 making the decision for them?

If the answer is no, the feature requires a stronger product justification.

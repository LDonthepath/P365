# P365 — User & Decision-Support Contract

**Status:** Product constraint  
**Primary MVP user:** Self-directed retail **Crypto + Gold trader**  
**Explanatory layer:** Macro  
**Product:** P365 Market Intelligence System

## 1. Purpose

P365 MVP is built first for a self-directed retail trader who actively trades **Crypto and Gold** and makes their own trading decisions. Macro is the explanatory layer used to understand the environment, catalysts, expectations, repricing, and transmission affecting those two markets.

The system must provide professional-grade market understanding without requiring institutional infrastructure or forcing the user to reconstruct the market narrative from disconnected indicators, headlines, and charts.

P365 remains a **Market Intelligence System**, not an advisory or execution system.

The long-term architecture may support additional financial-market domains, but MVP product value is judged first on whether P365 materially improves the Crypto + Gold trader's understanding of the market.

For the detailed evidence stack used to support that understanding—shared Macro drivers, BTC ETF/stablecoin/derivatives evidence, Gold ETF/COT evidence, relationship statistics, and event-window comparisons—use `P365-MVP-BTC-XAU-EVIDENCE-MAP-v0.1.md`.

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

For the MVP user, those questions should resolve into a practical pre-trade understanding:

```text
What changed in macro?
        ↓
What was expected / priced?
        ↓
How did rates / real yields / USD / liquidity react?
        ↓
How did Crypto react?
        ↓
How did Gold react?
        ↓
Do flow / positioning / structure confirm or contradict the move?
        ↓
Is the condition historically normal or unusual?
        ↓
What catalyst / invalidation should be monitored next?
```

P365 does not convert this chain into a BUY/SELL/LONG/SHORT instruction.

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

For MVP, first ask:

> **Does this materially improve a Crypto + Gold trader's understanding of market conditions, using Macro as the explanatory layer?**

If the answer is no, the feature is post-MVP unless it is required as supporting evidence for an approved Macro/Crypto/Gold reasoning chain.

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

For MVP, professional depth should remain concentrated on Macro → Crypto/Gold transmission rather than horizontal expansion into every asset class. Existing equity, credit, volatility, oil, or other cross-asset data may support interpretation, but those domains are not first-class MVP product surfaces merely because data is available.

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

> Does this make it easier for a self-directed retail Crypto + Gold trader to understand the macro environment, market repricing, and evidence affecting those markets and form their own decision, without P365 making the decision for them?

If the answer is no, the feature requires a stronger product justification.


## 8. MVP success gate

The MVP is not complete because it contains many indicators. It is complete when the user can move from market change to evidence-backed understanding across the approved vertical slice.

A successful MVP must make it possible to determine, with explicit provenance and time semantics:

1. what materially changed in the Macro environment;
2. what the relevant expectation or pricing baseline was;
3. whether a scheduled event produced factual surprise and/or market repricing;
4. how rates, real yields, USD and liquidity/funding context changed;
5. how Crypto and Gold responded;
6. whether qualified flow, positioning, volatility, or market-structure evidence confirms or contradicts the move;
7. whether the current condition is unusual relative to a defined historical baseline;
8. what the next material catalyst or invalidation condition is.

If those questions cannot be answered reliably, adding more first-class asset classes does not count as MVP progress.

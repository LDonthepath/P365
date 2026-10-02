# P365 Confirmation / Contradiction Contract v0.1

**Checkpoint:** CONF-001A  
**Status:** methodology/domain checkpoint  
**Scope:** non-causal composition of already-qualified evidence judgements

## Purpose

CONF-001A defines how P365 may combine independent evidence classes after a
market response has already been observed.

It answers:

> Do multiple independent evidence classes support the same interpretation,
> contradict it, conflict with each other, or remain insufficient?

CONF-001A does not decide whether a raw ETF flow, stablecoin change, CFTC
position, VIX move, or market-structure observation is supporting or
contradicting. Evidence-specific qualification and directional methodology
remain separate later checkpoints.

## Target

Every assessment requires an explicit target:

- BTC or Gold;
- canonical response Observation key;
- observed response direction (UP or DOWN);
- point-in-time knowledge cutoff;
- target identity;
- optional Event identity.

The target direction is evidence being evaluated, not a prediction.

## Approved evidence classes

CONF-001A v1 recognizes:

- FLOW;
- LIQUIDITY;
- POSITIONING;
- VOLATILITY;
- MARKET_STRUCTURE.

Examples of future qualified adapters may include BTC ETF flow, stablecoin
liquidity, Gold positioning, VIX, and market-structure evidence. Their inclusion
here does not authorize a directional mapping from raw values.

## Contribution contract

Every contribution must provide:

- deterministic evidence identity;
- evidence class;
- one already-qualified judgement:
  - SUPPORTING;
  - CONTRADICTING;
  - NEUTRAL;
  - UNRESOLVED;
- observedAt;
- knownAt;
- methodology ID/version;
- one or more source series keys.

Evidence with knownAt later than the target knowledge cutoff is forbidden.

## Independence rule

Provider count and series count are not independence.

All contributions inside one evidence class collapse to one class-level result.

A class resolves to:

- SUPPORTING when it contains supporting evidence and no contradicting evidence;
- CONTRADICTING when it contains contradicting evidence and no supporting evidence;
- CONFLICTED when both supporting and contradicting evidence exist inside the class;
- NON_DIRECTIONAL when only neutral/unresolved evidence exists.

CONFLICTED and NON_DIRECTIONAL classes do not receive a directional vote.

## Overall resolution

CONF-001A freezes a minimum of **two independent directional evidence classes**.

The aggregate result is:

- CONFIRMING:
  - at least two independent classes are SUPPORTING;
  - zero classes are CONTRADICTING.
- CONTRADICTING:
  - at least two independent classes are CONTRADICTING;
  - zero classes are SUPPORTING.
- MIXED:
  - at least one class is SUPPORTING;
  - at least one class is CONTRADICTING.
- INSUFFICIENT_EVIDENCE:
  - fewer than two independent directional classes remain after class-level
    conflict/neutral handling.

No majority override converts mixed evidence into a confirming or contradicting
conclusion.

## Causality boundary

Every assessment retains:

`causalAttribution = NOT_EVALUATED`

CONFIRMING means multiple independent evidence classes align with the assessed
interpretation. It does not mean those evidence classes caused the market move.

CONTRADICTING means multiple independent evidence classes point against the
assessed interpretation. It does not prove the observed market move is wrong or
will reverse.

## Current runtime boundary

CONF-001A is methodology/domain only.

It does not:

- wire BTC ETF flow, stablecoin, Gold COT, VIX, or another source;
- add dashboard queries;
- add provider calls;
- add persistence;
- create State / Regime / Risk / Intelligence;
- create BUY / SELL / LONG / SHORT output;
- predict continuation or reversal.

A later checkpoint must qualify evidence-specific SUPPORTING / CONTRADICTING
methodology before raw evidence can enter this contract.


## CONF-001B — BTC ETF daily net-flow adapter

CONF-001B qualifies the first evidence-specific adapter into the CONF-001A
composition contract.

The adapter consumes only the existing bounded `BtcEtfFlowReadModel`; it
performs no repository/provider/network I/O.

### Directional semantics

The canonical BTC ETF flow contract already freezes:

- positive value = net inflow;
- negative value = net outflow;
- provider-explicit numeric zero = factual zero.

CONF-001B maps that source-reported flow direction against an **already-observed**
BTC response:

- BTC UP + net inflow → SUPPORTING;
- BTC UP + net outflow → CONTRADICTING;
- BTC DOWN + net outflow → SUPPORTING;
- BTC DOWN + net inflow → CONTRADICTING;
- zero → NEUTRAL.

This is directional alignment of a qualified background capital-flow fact. It is
not a claim that ETF flow caused the BTC move, is contemporaneous with the
intraday event window, or predicts the next BTC return.

### Point-in-time rule

The adapter may use only a matured canonical flow point with
`retrievedAt <= target.knowledgeAt`.

Because the current read model collapses factual revisions for display, a later
revision can hide an earlier version that was historically knowable. In that
case CONF-001B fails closed to `UNRESOLVED`; it must not reconstruct or guess a
prior revision from the current value.

The adapter selects the latest point inside the bounded read model that can be
proven knowable by the target cutoff.

### Independence boundary

BTC ETF flow contributes only the `FLOW` evidence class.

Therefore CONF-001B by itself can never produce `CONFIRMING` or
`CONTRADICTING` under CONF-001A, which requires at least two independent
directional evidence classes.

Stablecoin liquidity is not part of CONF-001B. Stablecoin supply does not have
the same direct inflow/outflow semantics as BTC ETF daily net flow and requires
a separately approved relationship/qualification methodology before it may
produce a directional CONF contribution.


## CONF-001C — Gate 6 Briefing composition

CONF-001C surfaces the first runtime confirmation/contradiction assessment in
Market Briefing without adding any durable/provider/network read.

The composer reuses:

- the already-built Gate 3b RPR result;
- the already-built BTC ETF flow read model;
- the CONF-001B ETF-flow adapter;
- the CONF-001A independent-class composition policy.

### Confirmation target qualification

A BTC response is eligible only when:

- the event-window RPR assessment is `REPRICING_OBSERVED`;
- the window is `CLEAN`;
- the BTC response is `REPRICED`;
- BTC direction is UP or DOWN.

The evidence knowledge cutoff is the selected response window
`capturedAt`. Later ETF-flow retrievals or revisions cannot enter that earlier
assessment.

If no such target exists, Gate 6 is `INSUFFICIENT`.

### Current evidence state

CONF-001C currently has only one qualified evidence-specific adapter:

- `FLOW` — US spot BTC ETF daily net flow.

Therefore a qualified ETF-flow contribution may be shown as SUPPORTING,
CONTRADICTING, or NEUTRAL, but the overall CONF-001A assessment remains
`INSUFFICIENT_EVIDENCE` until a second independent directional evidence class
is separately qualified.

This is an intended product state, not an error. The Briefing must explicitly
show "belum cukup evidence" rather than manufacture confirmation from one class.

### Stablecoin boundary

A 2 Oct 2026 production audit found 38 distinct stablecoin effective-date
measurements but only 10 daily cohorts overlapping the currently retained BTC
spot history. Eight of those ten moved in the same direction, which is
descriptive only and insufficient for a production directional relationship.

Stablecoin liquidity therefore remains excluded from CONF runtime until its own
relationship calibration satisfies an approved methodology.

### Runtime boundary

CONF-001C introduces no new repository query, provider call, persistence owner,
scheduler, or ingestion path. It composes only data that the production
dashboard already reads.

The output remains:

- non-causal;
- non-predictive;
- non-prescriptive;
- independent of State / Regime / Risk / Intelligence;
- independent of trading recommendation, sizing, and execution.

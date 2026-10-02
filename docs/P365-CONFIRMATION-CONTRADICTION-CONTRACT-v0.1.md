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

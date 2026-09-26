# P365 Cross-Asset Transmission Contract v0.1

**Checkpoint:** TRN-001  
**Status:** PR #75 open; owner review/merge required  
**Scope:** Macro + Crypto + Gold event-window cross-asset response coherence  
**Prerequisites:** CMP-001, RPR-001, EVW-001, CAP-001 natural production proof

## Purpose

TRN-001 evaluates whether threshold-qualified market responses inside one governed event window are **coherent with an explicit cross-asset relationship methodology**.

It answers a deliberately narrow question:

> Given a driver that crossed its explicit RPR-001 threshold, did the configured response market also reprice, and did the observed directional relationship match the explicitly supplied relationship rule?

TRN-001 does **not** establish that the driver caused the response.

## Input chain

```text
Qualified Event Window
        ↓
CMP-001 PRE → post Snapshot Comparison
        ↓
RPR-001 explicit-threshold Event Repricing
        ↓
TRN-001 explicit relationship methodology
        ↓
Cross-Asset Transmission Assessment
```

TRN-001 must consume RPR-001. It must not re-read providers, re-resolve canonical observations, or invent an independent change/repricing path.

## Relationship-rule ownership

There are no built-in rules such as:

```text
DXY down → BTC up
real yield down → Gold up
Nasdaq up → BTC up
```

The normative MVP evidence contract explicitly states that these relationships are time-varying and can strengthen, weaken, invert, or disappear.

Every TRN-001 rule therefore requires:

- `driverObservationKey` — exact RPR-001 observation key;
- `responseObservationKey` — exact RPR-001 observation key;
- `expectedRelation`:
  - `SAME_DIRECTION`, or
  - `OPPOSITE_DIRECTION`;
- `methodologyId` — explicit owner of the relationship expectation;
- `methodologyVersion` — reproducible methodology version.

Rule ordering is non-semantic. Duplicate driver/response pairs are rejected.

TRN-001 v0.1 does not derive these relationship expectations from historical correlation. Historical relationship calibration is a separate explicit methodology/research checkpoint.

## Per-rule evidence

Each relationship rule resolves to one of:

- `COHERENT` — driver and response both crossed their explicit RPR-001 thresholds and their UP/DOWN relationship matches the supplied rule;
- `DIVERGENT` — both crossed their thresholds but the directional relationship differs from the supplied rule;
- `RESPONSE_BELOW_THRESHOLD` — the driver repriced but the configured response did not cross its own explicit threshold;
- `DRIVER_NOT_REPRICED` — the configured driver did not cross its own explicit threshold, so the rule cannot qualify as a transmission test;
- `UNRESOLVED` — required RPR-001 evidence is missing, unresolved, or lacks qualified directional evidence.

A price move that exists but remains below its explicit RPR-001 threshold is not silently promoted into a transmitted response.

## Assessment status

TRN-001 assessment status is:

- `COHERENT` — every configured rule is fully qualified and coherent;
- `DIVERGENT` — every configured rule is fully qualified and divergent;
- `NO_RESPONSE_REPRICING` — every qualified driver has a response below its RPR-001 threshold;
- `MIXED` — fully qualified rules resolve into more than one of the above clean evidence classes;
- `INDETERMINATE` — any required rule is unresolved, a driver did not qualify as repriced, RPR-001 is indeterminate, or the underlying comparison quality is not COMPLETE;
- `CONTAMINATED` — the governed event window contains another qualified HIGH point-event.

Contamination takes assessment precedence while preserving the measured per-rule evidence for audit.

## Causality boundary

Every TRN-001 assessment sets:

```text
causalAttribution = NOT_EVALUATED
```

TRN-001 uses the word transmission only as a governed product-layer test of **cross-asset response coherence** after RPR-001. It does not prove an economic causal channel.

In particular:

```text
co-movement
≠ causality

correlation
≠ causality

clean event window
≠ causal proof

directional coherence
≠ causal proof
```

TRN-001 does not infer:

- factual surprise;
- historical correlation or beta;
- causal direction;
- policy/economic mechanism;
- bullish/bearish meaning;
- risk-on/risk-off state;
- regime;
- Intelligence;
- trade signals, sizing, or execution.

## Point-in-time integrity

TRN-001 inherits the full canonical chain:

- EVW-001 owns event-window qualification and contamination;
- CMP-001 owns point-in-time canonical resolution and no-lookahead validation;
- RPR-001 owns explicit market-response thresholds;
- TRN-001 only evaluates explicit cross-asset relationship rules over those qualified outputs.

If the RPR-001 comparison quality is PARTIAL, STALE, or UNKNOWN, TRN-001 fails closed to `INDETERMINATE`.

## Determinism and identity

Rules are normalized and sorted deterministically.

Each rule receives a SHA-256 identity derived from its normalized:

- driver key;
- response key;
- expected relation;
- methodology ID;
- methodology version.

The complete assessment receives a deterministic `cross-asset-transmission-v1-...` SHA-256 identity.

Equivalent rule sets therefore produce the same assessment identity regardless of caller ordering.

## Current MVP boundary

TRN-001 is generic at the domain-contract level but does not expand the MVP universe.

Current first-class scope remains:

- Macro explanatory evidence;
- BTC / Crypto;
- Gold.

Existing supporting cross-asset observations may only participate when they are already canonically qualified and explicitly required by an approved relationship rule. This checkpoint adds no provider and no new market-data acquisition path.

The natural Durable Goods Orders CAP proof supplies COMPLETE event-window BTC/ETH/DXY/Gold observations that can exercise this contract once caller-owned RPR thresholds and relationship methodology are explicitly selected. TRN-001 does not invent those production policy values.

## Acceptance criteria

TRN-001 v0.1 passes when:

1. it consumes RPR-001 rather than re-resolving provider/canonical facts;
2. every relationship rule is explicit, versioned, deterministic, and unique by driver/response pair;
3. both driver and response must independently satisfy their RPR-001 thresholds before directional coherence can be claimed;
4. response-below-threshold evidence remains explicit;
5. missing/unresolved/degraded evidence fails closed;
6. contamination overrides clean assessment status without hiding measured edges;
7. no static cross-asset relationship is hardcoded;
8. `causalAttribution` remains `NOT_EVALUATED`;
9. deterministic identity and fail-closed invariants are regression-covered;
10. no Surprise, State, Risk, Regime, Intelligence, provider expansion, persistence owner, or trading logic is activated;
11. build/type checks pass before owner merge.

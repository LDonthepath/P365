# P365 Event Repricing Contract v0.1

**Checkpoint:** RPR-001  
**Status:** MERGED / production-ready contract — PR #74, merge `bb36fa81be57b8a11603c28e739e5bd2745c7d7a`  
**Scope:** Macro + Crypto + Gold event-window market response  
**Prerequisites:** EVW-001, CMP-001, CAP-001 natural production proof

## Purpose

RPR-001 converts a qualified factual PRE → post-event Snapshot Comparison into a threshold-governed **market repricing assessment**.

The contract answers only:

> Did one or more explicitly configured canonical market observations move far enough, inside the qualified event window, to satisfy the configured repricing threshold?

It does not answer why the move occurred.

## Input chain

```text
Qualified Event Window
        ↓
PRE Snapshot + post-event Snapshot
        ↓
CMP-001 point-in-time Snapshot Comparison
        ↓
RPR-001 explicit threshold policy
        ↓
Event Repricing Assessment
```

RPR-001 must consume CMP-001 rather than re-resolving or copying canonical market values.

## Threshold ownership

There is no universal default repricing threshold in v0.1.

Every evaluated observation key requires an explicit caller-owned threshold:

- `observationKey` — exact CMP-001 semantic observation slot;
- `basis`:
  - `ABSOLUTE_PERCENT_CHANGE`, or
  - `ABSOLUTE_CHANGE`;
- `minimumMagnitude` — finite value greater than zero.

Threshold input order is non-semantic. RPR-001 normalizes thresholds deterministically by observation key.

Missing thresholds do not imply zero threshold and do not silently evaluate an observation. Comparison keys without configured thresholds remain explicit as `unconfiguredObservationKeys`.

## Per-observation result

Each configured observation produces one response:

- `REPRICED` — qualified measured magnitude is greater than or equal to the explicit threshold;
- `BELOW_THRESHOLD` — qualified measured magnitude is below threshold;
- `UNRESOLVED` — the comparison slot is missing, added/removed, incompatible, unknown, or lacks the delta required by the configured basis.

Direction is a mechanical value comparison only:

- `UP`
- `DOWN`
- `FLAT`
- `UNKNOWN`

Direction does not mean bullish, bearish, hawkish, dovish, risk-on, risk-off, or causal transmission.

## Assessment status

For one PRE → post-event assessment:

- `REPRICING_OBSERVED` — at least one configured qualified observation crossed its threshold;
- `NO_REPRICING_OBSERVED` — all configured observations resolved and none crossed threshold;
- `INDETERMINATE` — no configured threshold crossed and at least one configured observation is unresolved;
- `CONTAMINATED` — another qualified HIGH point-event occurred between PRE and the evaluated post-event Snapshot.

`CONTAMINATED` takes precedence at the assessment level. Measured per-observation responses remain visible for audit, but the assessment must not be treated as a clean event-window repricing result.

## Causality boundary

Every v0.1 assessment sets:

```text
causalAttribution = NOT_EVALUATED
```

A clean event window is not proof that the primary event caused the market move.

RPR-001 therefore does not:

- infer factual surprise from actual versus expectation;
- claim that a surprise caused a move;
- infer cross-asset transmission;
- assign macro direction or regime meaning;
- produce State, Risk, Regime, Intelligence, trading signals, position sizing, or execution instructions.

Those require separate checkpoints.

## Point-in-time integrity

RPR-001 inherits CMP-001 point-in-time guarantees:

- canonical Observation values are resolved by ID;
- frozen Snapshot source/evidence/quality/semantic references are revalidated;
- Observation `observedAt` and `retrievedAt` cannot exceed each Snapshot capture cutoff;
- incompatible units/frequencies do not receive numerical comparison;
- missing canonical resolutions remain explicit.

RPR-001 must never weaken those rules or perform a fresh provider read as a fallback.

## Determinism and identity

Assessment identity is SHA-256 derived from the normalized complete assessment payload.

Equivalent inputs and equivalent threshold sets therefore produce the same `event-repricing-v1-...` identity regardless of caller threshold ordering.

Changing any material input — Snapshot comparison, event/window reference, threshold basis, threshold magnitude, contamination evidence, or resolved response — changes the assessment identity.

## Current MVP usage

The natural Durable Goods Orders production proof on 25 Sep 2026 produced compatible COMPLETE PRE/T+5/T+15/T+30/T+60 Snapshot inputs for:

- BTC spot;
- ETH spot;
- DXY;
- Gold futures.

RPR-001 does **not** invent production thresholds for those markets in this checkpoint. Threshold calibration is an explicit policy/research decision and must be approved before any runtime owner persists or presents a production repricing conclusion.

## RPR-002A calibration-only methodology

RPR-002A is a calibration checkpoint only. It does not activate RPR-001 in the
dashboard or Market Briefing and it does not freeze a production threshold.

The approved v1 candidate methodology is:

- source distribution: existing HIST-001 same-series, same-source, exact-horizon
  historical evidence;
- transformation: `ABSOLUTE_PERCENT_CHANGE`;
- candidate estimator: empirical continuous P90, using the same linear
  interpolation semantics as PostgreSQL `percentile_cont`;
- diagnostics: P50, P75, P90, and P95;
- calibration eligibility: at least **100 qualified exact-horizon samples**;
- candidate basis: `ABSOLUTE_PERCENT_CHANGE`;
- causality: always `NOT_EVALUATED`.

The 100-sample rule is a calibration-adequacy guard, not a market-move threshold.
If the sample set is smaller, RPR-002A returns `INSUFFICIENT_DATA` and must not
produce a threshold candidate.

RPR-002A candidates are review evidence only. A later owner-approved checkpoint
is required before any candidate can populate RPR-001 `EventRepricingThreshold[]`.

### Production data audit — 2 Oct 2026

A read-only production Market Memory audit used qualified BTC, DXY, and Gold
Observations and exact 10/20/35/65-minute pairs inside the current 36-hour HIST
calibration window.

| Series | Horizon | Samples | P75 | P90 | P95 | RPR-002A eligibility |
|---|---:|---:|---:|---:|---:|---|
| BTC spot | 10m | 111 | 0.111509% | 0.226434% | 0.335414% | candidate eligible |
| BTC spot | 20m | 121 | 0.172532% | 0.277038% | 0.366257% | candidate eligible |
| BTC spot | 35m | 110 | 0.267583% | 0.436381% | 0.783994% | candidate eligible |
| BTC spot | 65m | 122 | 0.460908% | 0.860764% | 1.193834% | candidate eligible |
| DXY | 10m | 133 | 0.038325% | 0.071222% | 0.094254% | candidate eligible |
| DXY | 20m | 101 | 0.063814% | 0.096451% | 0.120679% | candidate eligible |
| DXY | 35m | 106 | 0.081783% | 0.137335% | 0.159588% | candidate eligible |
| DXY | 65m | 128 | 0.087196% | 0.134415% | 0.156342% | candidate eligible |
| Gold futures | 10m | 35 | 0.089300% | 0.109212% | 0.151626% | insufficient |
| Gold futures | 20m | 31 | 0.160750% | 0.274966% | 0.300520% | insufficient |
| Gold futures | 35m | 33 | 0.248032% | 0.339629% | 0.408740% | insufficient |
| Gold futures | 65m | 43 | 0.262854% | 0.450422% | 0.563886% | insufficient |

These values are a dated calibration audit, not production thresholds. BTC and DXY
currently satisfy the v1 sample-adequacy gate at the tested horizons; Gold does not.
No threshold may be inferred for Gold from this audit.

## Acceptance criteria

RPR-001 v0.1 passes when:

1. it consumes a qualified CMP-001 PRE → post-event comparison;
2. thresholds are explicit, positive, finite, unique by observation key, and deterministic;
3. qualified numerical changes can resolve to `REPRICED` or `BELOW_THRESHOLD`;
4. missing/incompatible/unknown inputs fail closed to `UNRESOLVED`;
5. unconfigured comparison observations remain explicit;
6. contamination overrides the clean assessment status without hiding measured changes;
7. causal attribution remains `NOT_EVALUATED`;
8. no Surprise, Transmission, State, Risk, Regime, Intelligence, or trading logic is activated;
9. deterministic identity and the above invariants are regression-tested;
10. build/lint pass before owner review.

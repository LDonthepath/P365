# P365 Historical Relationship Evidence Contract v0.1

**Checkpoint:** REL-001 + REL-002A  
**Status:** REL-001 MERGED / REL-002A IMPLEMENTED — OWNER REVIEW PENDING  
**Scope:** read-only, point-in-time historical relationship measurement and material-MOVE cross-asset calibration

REL-001 measures reproducible historical association between two canonical Observation series. It does not infer causality, regime, expected direction, or trading meaning.

## REL-001 contract

Every measurement requires explicit series identities, optional provider qualification, transformation (LEVEL or CHANGE), observation start/end, point-in-time `asOf`, minimum sample size, methodology ID and methodology version.

Pairing is strict in v1: observations pair only when `observedAt` is identical. Repository reads are bounded by `retrievedAt <= asOf`, so later-known revisions cannot leak into an earlier reconstruction. When multiple revisions exist at one effective timestamp, the latest revision knowable by `asOf` is selected deterministically.

REL-001 reports Pearson correlation only when both series have non-zero variance and the transformed paired sample meets the caller-owned minimum sample size. Otherwise status is `INSUFFICIENT_DATA`. Sample size and exact Observation IDs remain in the evidence object.

`correlation` is association evidence only. Every output retains `causalAttribution = NOT_EVALUATED`.

## REL-002A — material-MOVE cross-asset calibration

REL-002A applies relationship measurement to the existing BTC/Gold continuous-MOVE calibration universe without converting the measurement into directional evidence.

### Trigger

REL-002A runs only when an existing MOVE-001C assessment is:

`status = MATERIAL_MOVE`

Only horizons already classified `MATERIAL_MOVE` are calibrated.

### Target / companion universe

For BTC:

- ETH spot;
- DXY;
- Gold futures;
- USDJPY;
- USDCNH.

For Gold:

- DXY;
- BTC spot;
- USDJPY;
- USDCNH.

All series reuse the same canonical series/source identities already used by MOVE-002 synchronous evidence. No provider is added.

### Historical sample lineage

REL-002A reuses the exact historical samples already carried by the material MOVE horizon:

- target start Observation ID;
- target end Observation ID;
- historical end timestamp;
- existing MOVE-001B 36-hour historical window;
- existing MOVE-001B minimum sample size of 120.

The wrapper does not invent a second materiality threshold and does not resample a different target-history universe.

### Cross-asset synchronization

A companion start/end point may match the target sample within the already-approved MOVE synchronous tolerance of **±120 seconds**.

No interpolation, forward-fill, backward-fill, or unbounded nearest-neighbor selection is allowed.

Repository reads remain bounded by the triggering MOVE assessment `asOf`. Revisions known after that cutoff are excluded.

### Measurement

Each eligible paired historical sample records:

- target signed percent change;
- companion signed percent change;
- exact target and companion Observation IDs;
- exact observed timestamps;
- factual alignment:
  - `SAME_DIRECTION`;
  - `OPPOSITE_DIRECTION`;
  - `FLAT`.

Per target/companion/horizon calibration reports:

- source MOVE historical sample count;
- successfully paired sample count;
- same-direction count;
- opposite-direction count;
- flat count;
- same-direction share among non-flat pairs;
- Pearson correlation of signed percent changes.

Pearson is the same shared numeric primitive used by REL-001. A pair is `MEASURED` only when the paired sample count meets the existing MOVE-001B minimum sample size and both transformed series have non-zero variance.

### Explicit non-decision

REL-002A intentionally defines:

`relationshipThreshold = NOT_DEFINED`

and:

`directionalQualification = NOT_EVALUATED`

Therefore REL-002A does **not** convert a correlation or directional share into:

- SUPPORTING;
- CONTRADICTING;
- SAME_DIRECTION expectation;
- OPPOSITE_DIRECTION expectation;
- bullish / bearish interpretation;
- continuation / reversal prediction.

A later REL-002B checkpoint may qualify a directional relationship only after production calibration results are reviewed and an explicit non-guessed methodology is approved.

Every output retains:

`causalAttribution = NOT_EVALUATED`

and:

`writesPerformed = false`

## Non-goals

REL-001 / REL-002A do not:

- define a correlation-strength threshold;
- promote raw cross-asset co-movement into causality;
- compute beta, lead/lag, regime, State, Risk, Intelligence, signals or execution;
- add providers, persistence owners, schedulers, database schema or UI;
- change MOVE-001 materiality thresholds;
- change CONF-001 evidence-class semantics.

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

The value 120 is retained only as **source MOVE calibration lineage**. REL-002A does not reuse it as proof of relationship statistical sufficiency. The wrapper does not invent a second materiality or relationship threshold and does not resample a different target-history universe.

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
- unpaired sample count;
- paired coverage ratio;
- count/share of target intervals that overlap another historical target interval;
- same-direction count;
- opposite-direction count;
- flat count;
- same-direction share among non-flat pairs;
- Pearson correlation of signed percent changes.

Pearson is the same shared numeric primitive used by REL-001. A pair is `OBSERVED` when at least two paired signed changes exist and both transformed series have non-zero variance. `OBSERVED` means only that the descriptive statistic can be calculated; it does **not** mean the relationship is statistically sufficient, stable, independent, predictive, or qualified for directional use.

### Explicit non-decision

REL-002A intentionally defines:

`relationshipThreshold = NOT_DEFINED`

`statisticalSufficiency = NOT_EVALUATED`

`sampleIndependence = NOT_EVALUATED`

`coverageLossAttribution = NOT_EVALUATED`

and:

`directionalQualification = NOT_EVALUATED`

Therefore REL-002A does **not** convert a correlation or directional share into:

- SUPPORTING;
- CONTRADICTING;
- SAME_DIRECTION expectation;
- OPPOSITE_DIRECTION expectation;
- bullish / bearish interpretation;
- continuation / reversal prediction.

REL-002A is currently a library primitive only. No dashboard, route, scheduler, job, or production runtime path invokes it, so this checkpoint does **not** claim that production calibration results exist.

The next permitted step is a read-only diagnostic/presentation caller that exposes real point-in-time results, including pairing coverage and overlap diagnostics. A later REL-002B checkpoint may qualify a directional relationship only after those production observations are reviewed and an explicit non-guessed methodology for dependence, coverage, stability, and relationship qualification is approved.

Every output retains:

`causalAttribution = NOT_EVALUATED`

and:

`writesPerformed = false`

## Non-goals

REL-001 / REL-002A do not:

- define a correlation-strength threshold or statistical-significance threshold;
- treat the MOVE-001B 120-sample requirement as relationship sufficiency;
- claim overlapping historical windows are independent samples;
- attribute missing cross-asset pairs to weekends, exchange sessions, outages, or provider behavior without separate evidence;
- promote raw cross-asset co-movement into causality;
- compute beta, lead/lag, regime, State, Risk, Intelligence, signals or execution;
- add providers, persistence owners, schedulers, database schema or UI;
- change MOVE-001 materiality thresholds;
- change CONF-001 evidence-class semantics.

# P365 US SEP / Dot Plot Contract v0.1

**Status:** SOURCE QUALIFIED / COMPARISON METHODOLOGY FROZEN / MACRO-SEP-001B RUNTIME IMPLEMENTED — OWNER MERGE PENDING

**Checkpoint:** MACRO-SEP-001A — US SEP / Dot Plot Source Qualification & Policy-Path Comparison Boundary

**MVP scope:** Macro explanatory layer → BTC + Gold

**Audit date:** 6 October 2026

## 1. Purpose

This checkpoint closes the source and methodology gap for the Federal Reserve Summary of Economic Projections (SEP), especially the federal-funds-rate “dot plot”, without activating a regime monitor.

It answers two narrow questions:

1. What did FOMC participants publish as their individual assessments of appropriate year-end policy-rate levels?
2. When qualified market-implied policy pricing exists, how may P365 compare that market path with SEP without mixing unlike horizons or inventing a hawkish/dovish regime label?

This checkpoint is documentation/source-qualification only.

It does not add provider runtime code, credentials, scheduler jobs, durable writes, UI, State, Regime, Risk, Intelligence, causal attribution, or trading logic.

## 2. Evidence-class boundary

SEP and market pricing are different evidence classes and must remain separate.

SEP / Dot Plot:

- marketDomain: POLICY
- informationClass: EXPECTATION
- jurisdiction: US
- instrument: POLICY_RATE
- source: Board of Governors of the Federal Reserve System
- meaning: FOMC participants’ individual assessments of appropriate monetary policy

Market-implied policy path:

- marketDomain: RATES
- informationClass: PRICING
- jurisdiction: US
- instrument: FUTURE
- source boundary: governed by P365 US Policy-Implied Pricing Contract v0.1
- meaning: derivatives-implied distribution of future FOMC outcomes

Therefore:

SEP dot != market probability

SEP median != market-implied expected rate

SEP year-end point != arbitrary FOMC meeting probability

Neither evidence family is a prediction produced by P365.

## 3. Primary SEP source qualification

### 3.1 Selected source

The primary source is the Federal Reserve Board’s official accessible HTML for FOMC projection materials.

Audited current example:

https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm

Official release page:

https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916b.htm

The accessible HTML is preferred over PDF extraction because it exposes the required policy-path information as machine-readable tables.

The September 16, 2026 accessible material contains:

- Table 1 with published median, central tendency, and range for the federal funds rate;
- Figure 2 as a tabular distribution of participant counts by projected midpoint;
- annual horizons plus “Longer run”;
- an explicit note that each dot is rounded to the nearest 1/8 percentage point.

Historical accessible pages exist on the same official Federal Reserve domain for earlier SEP releases.

### 3.2 Source verdict

> FEDERAL RESERVE ACCESSIBLE SEP HTML: QUALIFIED PRIMARY SOURCE FOR US OFFICIAL POLICY PROJECTIONS / DOT-PLOT DISTRIBUTION

Why it qualifies:

- first-party central-bank source;
- official release timestamp;
- no third-party transformation required;
- dot distribution is available as structured HTML rather than image-only data;
- median and distribution are both present;
- historical release pages are publicly accessible;
- no paid provider is required for the SEP side.

### 3.3 PDF boundary

The PDF may be retained only as a human-verification fallback.

P365 must not make OCR, screenshot parsing, chart-image interpretation, or manually transcribed coordinates the canonical ingestion path while the official accessible HTML is available.

### 3.4 Discovery boundary

A future runtime should discover SEP material from official Federal Reserve release/calendar links.

It must not rely solely on guessing a URL from a date pattern.

## 4. Canonical raw evidence

P365 should retain two separate raw SEP fact families.

### 4.1 Published median policy path

For each SEP release and each published horizon:

- YEAR_END_<YYYY>
- LONGER_RUN

retain the Federal Reserve-published median midpoint of the appropriate federal-funds target range/level.

Illustrative series-key shape:

policy.us.sep.ffr.year_end_2027.median_pct

policy.us.sep.ffr.longer_run.median_pct

The source-published median is authoritative as a published aggregate.

P365 must not replace it with a median recomputed from dot counts.

### 4.2 Dot distribution

For each horizon and each displayed midpoint bucket, retain:

- horizon;
- midpoint percentage level;
- participant count.

Illustrative series-key shape:

policy.us.sep.ffr.year_end_2027.midpoint_4125_millipct.participant_count

Here 4125 millipct means 4.125 percent.

This integer representation avoids floating-point identity ambiguity while preserving the Federal Reserve’s 1/8-percentage-point dot grid.

For LONGER_RUN:

policy.us.sep.ffr.longer_run.midpoint_3000_millipct.participant_count

The release timestamp remains the Observation time; the release date should not be duplicated into every series key.

## 5. Canonical compatibility

A future runtime should preserve the existing additive semantic model.

Recommended Observation compatibility:

- legacy domain: MACRO
- marketDomain: POLICY
- informationClass: EXPECTATION
- jurisdiction: US
- instrument: POLICY_RATE
- asset: none
- tenor/horizon: YEAR_END_<YYYY> or LONGER_RUN
- unit:
  - PERCENT for published medians
  - COUNT for participant buckets

Required metadata/provenance:

- provider/source = federal-reserve;
- SEP release date;
- official release URL;
- accessible-material URL;
- FOMC meeting start/end date when available;
- horizon;
- source-published midpoint;
- participant count where applicable;
- published median where applicable;
- source note that dot values are rounded to nearest 1/8 percentage point;
- release timestamp;
- retrieval timestamp;
- parser/schema version.

No participant identity may be invented. The public dot plot is anonymous distribution evidence.

## 6. Time semantics

SEP has at least four distinct times/periods:

1. FOMC meeting dates;
2. official SEP release timestamp;
3. projection horizon (year-end or longer run);
4. P365 retrieval timestamp.

They must not be collapsed.

For canonical point-in-time availability:

- observedAt = official SEP publication/release timestamp;
- retrievedAt = P365 successful acquisition time;
- projection horizon stays in identity/metadata;
- FOMC meeting date stays in metadata/event linkage.

If the source page gives release time in EST/EDT, runtime must convert the stated source timezone to UTC explicitly.

Retrieval time must never substitute for a missing publication time.

## 7. Validation rules

A future parser must fail closed unless:

1. the page is an official Federal Reserve projection-material page;
2. the page identifies a release date/time;
3. Table 1 exposes the federal-funds-rate projected appropriate policy path;
4. Figure 2 exposes a midpoint-by-horizon participant-count table;
5. midpoint values parse as finite percentages;
6. participant counts parse as non-negative integers;
7. empty cells remain missing/zero-count presentation cells according to the source table and are not fabricated into participant observations;
8. published medians are retained separately from the dot histogram;
9. LONGER_RUN is not converted into a calendar year;
10. no participant name is inferred;
11. parser/schema drift produces UNAVAILABLE/ERROR rather than guessed data.

The total participant count may differ by horizon. P365 must not hardcode one global participant count.

## 8. SEP versus market-pricing comparison

This comparison is a deterministic derived factual layer, not a new raw evidence family.

It may be activated only when both:

- qualified SEP observations are durable; and
- qualified market-pricing probability grids are available under MACRO-PRICING-001A or its approved successor.

### 8.1 Horizon-alignment rule

SEP annual points are year-end assessments.

For SEP horizon YEAR_END_Y, market pricing may be compared only against a qualified year-end anchor meeting:

> the final officially scheduled FOMC decision meeting whose decision date falls within calendar year Y.

The anchor meeting must come from an official/qualified FOMC calendar.

Do not:

- compare a SEP year-end dot with an arbitrary near-term meeting;
- map LONGER_RUN to a FedWatch meeting;
- invent a future FOMC date when the official calendar/provider coverage is unavailable.

If no qualified anchor meeting exists, comparison status is NOT_COMPARABLE.

### 8.2 Market distribution input

For the selected year-end anchor meeting, consume the complete provider-native target-rate probability grid from the existing policy-pricing contract.

Each bucket contributes:

- target lower bound;
- target upper bound;
- probability.

The comparable bucket midpoint is:

targetMidpointPct = ((lowerBp + upperBp) / 2) / 100

The probability grid must satisfy the existing provider validation rules.

For the comparison, the sum of included probabilities must be within a provider-appropriate rounding tolerance around 100 percent. Otherwise fail closed.

### 8.3 Market expected midpoint

The primary thin comparison metric is the probability-weighted expected target midpoint:

marketExpectedMidpointPct =
  sum(probability_i × targetMidpointPct_i) / sum(probability_i)

This is a P365-derived deterministic metric.

It must be labeled as derived and retain all input probability-bucket lineage.

It is not a provider-native FedWatch field unless the provider explicitly publishes the same metric.

### 8.4 SEP-market gap

For aligned YEAR_END_Y:

sepMarketGapBps =
  (marketExpectedMidpointPct - sepPublishedMedianPct) × 100

Interpretation is factual only:

- positive: market-implied expected midpoint is above the SEP published median;
- negative: market-implied expected midpoint is below the SEP published median;
- zero/near-zero: values are close at the displayed precision.

Do not relabel this gap as:

- hawkish;
- dovish;
- bullish;
- bearish;
- risk-on;
- risk-off;
- regime;
- policy error;
- trade signal.

### 8.5 Current-state versus release-window comparison

Two different questions must remain separate.

Current state:

- compare latest qualified market pricing at the dashboard/briefing cutoff with the latest qualified SEP.

SEP release repricing:

- compare a qualified pre-release market snapshot with a separately qualified post-release market snapshot around the SEP publication event.

A current-state gap must not be presented as the market reaction to the SEP release.

Release-window repricing remains governed by the event/snapshot/repricing contracts.

## 9. Longer-run boundary

The SEP LONGER_RUN dot is not a dated FOMC decision horizon.

Therefore:

- retain it as official POLICY / EXPECTATION evidence;
- do not compare it directly to a FedWatch meeting;
- do not substitute a Treasury yield, SOFR spot, KC PRU, or other proxy;
- any future comparison with a far-forward market rate requires a separate methodology checkpoint.

## 10. Market-pricing provider boundary remains unchanged

MACRO-PRICING-001A remains authoritative for the market side.

Current status remains:

- CME FedWatch: semantically qualified;
- automated durable webpage scraping: prohibited by the existing contract;
- API entitlement/licensing for P365: unresolved;
- runtime: not approved.

This checkpoint does not authorize a paid provider.

Under the current FREE_ONLY project boundary, the market-pricing runtime remains blocked until either:

1. a legally compatible free source with equivalent meeting-level probability semantics is qualified; or
2. the owner explicitly changes the provider-access policy.

Kansas City Fed Policy Rate Uncertainty (KC PRU) and Policy Rate Skew (KC PRS) are useful market-based supporting indicators, but they do not provide the required meeting-by-meeting target-rate probability grid and therefore are not substitutes for MACRO-PRICING-001A.

## 11. What becomes possible after both runtimes exist

A later factual Policy Expectations surface may show:

- latest SEP median by year;
- dot distribution by year;
- latest market-implied year-end expected midpoint where horizon alignment is valid;
- SEP-market gap in basis points;
- freshness/as-of for both sides;
- explicit NOT_COMPARABLE states.

This is sufficient to answer:

> What policy path did FOMC participants publish, what path is the market pricing, and where do they differ on aligned horizons?

It is not sufficient to answer:

> What market regime are we in?

## 12. Regime boundary

MACRO-SEP-001A does not define a regime.

A regime monitor still requires, at minimum:

- qualified live/durable market-pricing evidence;
- an explicit rule for material changes in the SEP-market gap;
- historical calibration of that change;
- confirmation/contradiction/invalidation rules;
- treatment of policy-path revisions versus macro-data shocks;
- treatment of liquidity/funding and rates-volatility context;
- explicit non-causal semantics unless causality is separately qualified.

Until those gates exist, P365 must present the policy pillar as factual/expectation/pricing evidence only.

## 13. Acceptance criteria

MACRO-SEP-001A passes only if:

1. Federal Reserve accessible SEP HTML is selected as the primary dot-plot source;
2. PDF/OCR/image parsing is explicitly non-canonical;
3. published median and dot distribution are distinct raw facts;
4. SEP is classified as POLICY / EXPECTATION, not market PRICING;
5. release time, retrieval time, FOMC meeting dates, and projection horizon remain separate;
6. year-end market comparison uses only the final officially scheduled FOMC meeting in the same calendar year;
7. LONGER_RUN is not force-mapped to a meeting;
8. the market expected midpoint formula is explicit and deterministic;
9. the SEP-market gap formula is explicit and expressed in basis points;
10. market-pricing provider governance remains owned by MACRO-PRICING-001A;
11. no paid provider is authorized;
12. no UI/runtime/scheduler/persistence is added;
13. no bullish/bearish/hawkish/dovish/regime/trading semantics are added.

## 14. Next checkpoints

### MACRO-SEP-001B — Federal Reserve SEP factual runtime

Implemented on the current feature branch pending owner merge:

- reuses the existing Federal Reserve source identity and official FOMC calendar;
- discovers the latest published accessible SEP HTML instead of guessing a future URL;
- parses Table 1 published medians and Figure 2 nonzero participant-count buckets under strict schema checks;
- normalizes canonical SEP median + dot-count Observations as POLICY / EXPECTATION;
- preserves official release timestamp separately from P365 retrieval time;
- persists append-only durable history through the existing authenticated historical-ingestion / Market Memory path;
- repeated unchanged acquisition remains idempotent;
- no scheduler, historical backfill, UI, market-pricing runtime or regime reasoning is activated.

### MACRO-PRICING-001B — Market policy-pricing runtime

Still blocked by the existing access/licensing/free-source gate.

Do not implement until provider access is explicitly approved.

### MACRO-POLICY-002A — SEP versus market-pricing factual comparator

Only after both evidence families are durable.

It may compute aligned year-end expected midpoint and gapBps exactly as frozen here, with no regime label.

### MOVE Index

Rates volatility remains a separate evidence checkpoint and must not be bundled into SEP or policy-pricing runtime work.

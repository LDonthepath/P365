# P365 Gold CFTC COT Positioning Contract v0.1

**Status:** RUNTIME IMPLEMENTED / LIVE PRE VERIFICATION & PRODUCTION ACTIVATION PENDING

**Checkpoints:** GOLD-POS-001A contract/source qualification; GOLD-POS-001B factual runtime

**MVP scope:** Gold

**Audit date:** 30 September 2026

## 1. Purpose

This contract freezes the factual meaning, source family, participant taxonomy,
time semantics, canonical series family, historical requirements, and source
qualification boundary for CFTC Commitments of Traders positioning evidence for
Gold.

This checkpoint is documentation/source-qualification only.

It does not add a provider runtime, dependency, scheduler, backfill, Supabase
write path, percentile/z-score, UI, reasoning, State, Regime, Risk,
Intelligence, or trading logic.

## 2. Reasoning question

The COT evidence answers:

> How are reportable and non-reportable participants positioned in the primary
> COMEX Gold futures contract as of the CFTC report date?

It does not answer:

- whether Gold is bullish or bearish;
- whether participants will add or reduce exposure next;
- whether COT positioning caused a Gold price move;
- intraday order flow;
- Gold ETF flow;
- physical Gold demand;
- central-bank Gold demand;
- participant cost basis;
- option delta exposure;
- total OTC Gold positioning.

COT is positioning evidence, not a trade signal.

## 3. Source family

P365 selects the **CFTC Disaggregated Commitments of Traders — Futures Only**
report family as the target source for Gold positioning.

Official Public Reporting Environment dataset:

`72hh-3qpy`

Target Gold contract:

- market/exchange name: `GOLD - COMMODITY EXCHANGE INC.`
- CFTC contract market code: `088691`
- exchange code in traditional COT reports: `CMX`
- source contract unit: 100 troy ounces per futures contract

The stable CFTC contract market code, not a display-name substring, owns runtime
contract selection.

P365 must not silently substitute:

- Micro Gold;
- other Gold contracts;
- Gold options;
- futures-and-options-combined data;
- legacy commercial/non-commercial categories;
- another exchange or venue.

## 4. Why Disaggregated Futures Only

CFTC publishes several COT report families.

For Gold, the Disaggregated report is preferred because physical commodity
markets are separated into:

1. Producer/Merchant/Processor/User;
2. Swap Dealers;
3. Managed Money;
4. Other Reportables.

The Legacy report collapses reportable traders into broader commercial and
non-commercial groups. That loses the managed-money separation required by the
P365 Gold evidence map.

The Futures-and-Options Combined report is a different measurement family and
must not be mixed into the same canonical history as Futures Only.

Therefore:

> **GOLD-POS-001 v0.1 = CFTC DISAGGREGATED FUTURES ONLY / 088691**

Any future combined-options positioning product requires a separate series and
methodology contract.

## 5. Raw canonical series family

Raw source-reported positions are canonical factual Observations.

All series use:

- legacy Observation domain: `MARKET`
- marketDomain: `COMMODITY`
- informationClass: `POSITIONING`
- jurisdiction: `US`
- instrument: `FUTURE`
- asset: `GOLD`
- unit: `CONTRACTS`
- frequency: `WEEKLY`
- source family: CFTC Disaggregated Futures Only
- contract market code: `088691`

Jurisdiction `US` describes the CFTC-regulated COMEX futures market being
measured. It does not claim that every underlying trader is domiciled in the
United States.

### 5.1 Total open interest

`gold.cftc.comex.open_interest.contracts`

Source field:

`open_interest_all`

This is total futures open interest for the target contract.

It is not itself a participant position and must remain distinguishable from
participant-category long/short/spreading series.

### 5.2 Producer / Merchant / Processor / User

`gold.cftc.producer_merchant.long.contracts`

Source field:

`prod_merc_positions_long` or the exact provider-native field exposed by the
qualified API schema.

`gold.cftc.producer_merchant.short.contracts`

Source field:

`prod_merc_positions_short` or exact qualified schema equivalent.

CFTC does not report a separate spreading column for this category in the
Disaggregated report.

Participant semantic:

`PRODUCER_MERCHANT_PROCESSOR_USER`

### 5.3 Swap Dealers

`gold.cftc.swap_dealer.long.contracts`

`gold.cftc.swap_dealer.short.contracts`

`gold.cftc.swap_dealer.spreading.contracts`

Participant semantic:

`SWAP_DEALER`

### 5.4 Managed Money

`gold.cftc.managed_money.long.contracts`

`gold.cftc.managed_money.short.contracts`

`gold.cftc.managed_money.spreading.contracts`

Qualified PRE fields include the provider-native managed-money long/short
family such as:

`m_money_positions_long_all`

`m_money_positions_short_all`

The runtime checkpoint must pin the exact field names from the live PRE schema
before canonical writes.

Participant semantic:

`MANAGED_MONEY`

CFTC defines Money Manager for this report as registered commodity trading
advisors, commodity pool operators, or unregistered funds identified by CFTC
that manage organized futures trading on behalf of clients.

P365 must not rename this category to "hedge funds" or "institutional demand".

### 5.5 Other Reportables

`gold.cftc.other_reportables.long.contracts`

`gold.cftc.other_reportables.short.contracts`

`gold.cftc.other_reportables.spreading.contracts`

Participant semantic:

`OTHER_REPORTABLES`

This category means reportable traders not placed in the other three
Disaggregated categories.

### 5.6 Non-reportable positions

`gold.cftc.nonreportable.long.contracts`

`gold.cftc.nonreportable.short.contracts`

Participant semantic:

`NONREPORTABLE`

CFTC derives these positions as the residual between total open interest and
reportable positions.

"Non-reportable" must not be renamed "retail". The CFTC classification is based
on reporting thresholds, not a retail-investor identity.

## 6. Spreading semantics

For Swap Dealers, Managed Money, and Other Reportables, CFTC publishes a
spreading category.

Spreading represents offsetting positions according to the CFTC methodology.
It is not directional long exposure and not directional short exposure.

P365 must preserve spreading as a separate factual series.

It must not:

- add spreading to long;
- subtract spreading from short;
- infer a directional side;
- drop it while claiming a complete participant exposure picture.

## 7. Derived net positioning

Net positioning is useful but is not a source-reported raw fact when calculated
as:

`long - short`

Therefore any series such as:

`gold.cftc.managed_money.net.contracts`

must be classified as:

- marketDomain: `COMMODITY`
- informationClass: `DERIVED_METRIC`
- methodology: exact long minus short
- explicit methodology version
- explicit input canonical IDs

GOLD-POS-001A does **not** authorize derived net, percentile, z-score, crowding,
extreme, bullish/bearish, or historical-normality labels.

Those require a later derived-methodology checkpoint.

## 8. Time semantics

COT has two materially different times.

### 8.1 Report/effective date

CFTC COT reports describe positions as of Tuesday's open-interest snapshot.

The provider `report_date_as_yyyy_mm_dd` is the canonical positioning
effective date.

P365 may normalize that date to:

`YYYY-MM-DDT00:00:00.000Z`

only as a deterministic effective-date anchor.

That anchor is not a release time and not the moment the positions were known
to the public.

### 8.2 Release/publication time

CFTC normally releases the weekly COT reports at 3:30 p.m. US Eastern time on
Friday, using data from the previous Tuesday.

Federal holidays can delay the release by one or two days, and CFTC publishes
a release schedule.

The runtime must not derive a fixed Friday release timestamp blindly.

Unless an exact release timestamp is obtained from a qualified CFTC source,
P365 should use:

- effective/report date from the row;
- `retrievedAt` from the successful P365 acquisition;
- no fabricated `releasedAt`.

For point-in-time historical reconstruction, a Tuesday position must not be
treated as knowable on Tuesday merely because its effective date is Tuesday.

## 9. Acquisition cadence

The source is weekly.

The scheduler must not poll at intraday market-data frequency.

An appropriate production runtime should:

- acquire shortly after the official scheduled release window;
- perform a bounded later recheck for corrections/late release;
- account for holiday-delayed release dates;
- avoid synthetic daily rows.

COT positioning is background/confirmation evidence for an intraday Gold user,
not an intraday positioning measurement.

## 10. Historical continuity

The CFTC provides current and historical COT data.

Disaggregated historical data extend back to 2006, with yearly historical
download files available from CFTC.

This depth is sufficient for future weekly historical context and positioning
distribution methodology.

Runtime backfill must:

- select only CFTC code `088691`;
- keep Futures Only distinct from Combined;
- preserve report dates;
- preserve participant category;
- preserve source dataset identity;
- fail closed on duplicate target rows for one report date;
- never synthesize missing weeks.

## 11. Revision semantics

Future runtime must reuse FND-018A Observation identity.

For each raw participant-position series:

```text
MARKET
+ canonical seriesKey
+ normalized report/effective date
→ measurement identity
```

A changed factual value for the same report date creates an append-only
revision.

`retrievedAt` does not enter factual identity.

A metadata-only change does not create a factual revision.

CFTC notes that trader classifications may change when staff receive additional
information. P365 must therefore preserve later factual corrections/revisions
rather than overwriting earlier durable history.

## 12. Missing and zero semantics

`missing != zero`

Explicit numeric zero is factual.

The following are not zero:

- absent field;
- null;
- malformed numeric value;
- missing target contract;
- unavailable PRE/API;
- publication delay;
- suppressed trader counts;
- unsupported or changed schema.

CFTC may suppress **numbers of traders** for confidentiality when a category has
fewer than four active traders. Suppressed trader counts must not be converted
to zero.

This checkpoint does not require trader-count series for canonical MVP
positioning.

## 13. Source qualification — CFTC Public Reporting Environment

### Identity and semantics

The official CFTC Disaggregated COT report directly provides the participant
categories required by the Gold evidence map.

CFTC code `088691` identifies the COMEX Gold contract in the official report.

### API access

CFTC's Public Reporting Environment provides programmatic API access and
download formats including CSV and JSON-compatible API responses.

Official dataset identity:

`72hh-3qpy`

No website scraping is required.

### Release discipline

CFTC states the reports are normally released Friday at 3:30 p.m. Eastern and
normally contain positions from the previous Tuesday. The official annual
release schedule identifies holiday-delayed dates.

### History

CFTC publishes historical Disaggregated Futures Only files by year and states
historical disaggregated data extend back to 2006.

### Usage rights

CFTC's Web Policy states that government information on the CFTC website is in
the public domain and may be freely copied and distributed with appropriate
acknowledgement requested.

This is materially stronger for P365's internal durable use than the Gold ETF
sources audited in GOLD-FLOW-001A.

Third-party material encountered on CFTC pages remains subject to its own
rights, but the target COT government dataset is CFTC government information.

### Source verdict

> **CFTC DISAGGREGATED FUTURES ONLY / 088691: QUALIFIED CANDIDATE — OFFICIAL,
> AUTOMATABLE, HISTORICAL, PUBLIC-DOMAIN GOVERNMENT DATA**

The source satisfies the source-qualification gate for a future isolated
runtime checkpoint.

Provider runtime expansion still requires owner approval under P365 repository
governance.

## 14. Runtime acceptance gate

A future GOLD-POS-001B implementation must prove at minimum:

1. only dataset `72hh-3qpy` is used;
2. only CFTC contract market code `088691` is canonicalized;
3. Futures Only and Combined are never mixed;
4. every required provider field is schema-validated;
5. report date is distinct from retrieval/release availability;
6. no fixed Friday release timestamp is fabricated;
7. raw long/short/spreading values remain distinct;
8. non-reportable is not renamed retail;
9. participant semantics are explicit;
10. no derived net/percentile/z-score enters the raw factual layer;
11. bounded backfill is deterministic;
12. unchanged weekly facts are idempotent;
13. changed factual values append as FND-018A revisions;
14. Observation Evidence uses stable semantic effective time;
15. provider errors/empty/schema drift fail closed;
16. acquisition cadence respects the weekly release schedule;
17. no UI or reasoning interpretation is introduced.

## 15. Rejected shortcuts

This contract rejects:

- Legacy non-commercial positions as a silent substitute for Managed Money;
- Futures-and-Options Combined as a substitute for Futures Only;
- Micro Gold as a substitute for the target full-size contract;
- net long as a provider-native fact when P365 computed it;
- non-reportable as "retail";
- weekly COT values forward-filled into daily observations;
- Tuesday effective date treated as Tuesday public knowledge;
- a hardcoded Friday timestamp ignoring holiday-delayed releases;
- COT positioning used as a substitute for Gold ETF flow;
- COT positioning converted directly into a directional trading signal.

## 16. Checkpoint verdict

> **GOLD-POS-001A: CONTRACT FROZEN / CFTC SOURCE QUALIFIED CANDIDATE —
> RUNTIME OWNER APPROVAL PENDING**

No runtime code is added by this checkpoint.

## 17. Out of scope

- provider/runtime adapter;
- API token/application token;
- Supabase writes;
- scheduler;
- backfill;
- derived net positioning;
- percentile/z-score/crowding;
- COMEX price/OI derived analysis;
- Gold ETF flow;
- UI;
- confirmation/contradiction;
- State/Regime/Risk/Intelligence;
- trading recommendation.


## 18. GOLD-POS-001B runtime implementation

GOLD-POS-001B implements the qualified CFTC source through the existing
historical-ingestion owner.

Runtime boundaries:

- provider: CFTC Public Reporting Environment;
- resource: `/resource/72hh-3qpy.json`;
- target contract: `088691`;
- report family: Disaggregated Futures Only;
- FORWARD: bounded rolling recheck of the 8 most recent weekly reports;
- BACKFILL: one provider only, explicit from/to bounds, maximum 370 inclusive
  calendar days per request;
- source values: raw contract counts only;
- canonical output: 14 raw weekly series covering open interest plus
  Producer/Merchant, Swap Dealer, Managed Money, Other Reportables, and
  Non-reportable long/short/spreading families where the source reports them;
- canonical quality: `UNKNOWN` until release-calendar-aware freshness is
  separately qualified;
- report date is retained as semantic effective time;
- `retrievedAt` is P365 acquisition availability;
- no `releasedAt` or `publishedAt` is fabricated;
- Observation identity/revisions reuse FND-018A;
- Observation Evidence uses semantic observation effective time for stable
  Market Memory dedupe;
- provider field identity and CFTC contract code are retained in provenance;
- schema mismatch, duplicate report dates, wrong contract, non-Futures-Only
  rows, malformed counts, and out-of-bound backfill responses fail closed.

The adapter accepts only explicit field-name aliases grounded in the official
CFTC Disaggregated variable schema. The exact live PRE JSON schema remains a
production smoke gate: if PRE field identifiers differ, the provider returns
`ERROR` before canonical persistence rather than guessing.

GOLD-POS-001B does not add a scheduler, production backfill, derived net
position, percentile/z-score, UI, confirmation/contradiction, or higher-order
reasoning.

Checkpoint status:

> **RUNTIME IMPLEMENTED / LIVE PRE VERIFICATION & PRODUCTION ACTIVATION PENDING**

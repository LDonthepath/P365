# P365 Gold ETF Flow & Holdings Evidence Contract v0.1

**Status:** CONTRACT DEFINED — RUNTIME SOURCE NOT YET QUALIFIED

**Checkpoint:** GOLD-FLOW-001A contract and source qualification

**MVP scope:** Gold

**Audit date:** 30 September 2026

## 1. Purpose

This contract freezes the factual meaning, canonical semantics, time boundaries,
history requirements, and source-qualification gate for Gold ETF flow and
holdings evidence required by the P365 Macro → Gold intelligence chain.

This checkpoint is documentation/source-qualification only.

It does not add a provider, runtime fetcher, dependency, scheduler, database
schema, UI, reasoning, State, Regime, Risk, Intelligence, or trading logic.

## 2. Reasoning questions

The paired evidence answers only:

1. **Flow:** How much net capital entered or left the qualified physically-backed
   Gold ETF universe over the provider-defined measurement period?
2. **Holdings:** How much physical Gold was held by the qualified physically-backed
   Gold ETF universe at the provider-defined effective date?

These are distinct facts.

```text
ETF flow
≠
ETF holdings
≠
Gold price
≠
ETF trading volume
≠
COMEX open interest
≠
CFTC positioning
```

A change in holdings is not automatically a USD fund-flow figure, and a USD
fund-flow figure is not a participant-positioning series.

## 3. Canonical series

### 3.1 Global physically-backed Gold ETF net flow

Preferred logical series key:

`gold.global_physically_backed_etf_net_flow.usd`

Meaning:

> Provider-qualified aggregate net capital flow in USD into/out of the global
> physically-backed Gold ETF and similar-product universe for one explicit
> measurement period.

Canonical dimensions:

| Dimension | Value |
|---|---|
| legacy Observation domain | `MARKET` |
| marketDomain | `COMMODITY` |
| informationClass | `FLOW` |
| jurisdiction | `GLOBAL` |
| instrument | `ETF` |
| asset | `GOLD` |
| unit | `USD` |

Positive = provider-reported net inflow.

Negative = provider-reported net outflow.

Zero is factual only when the source explicitly reports numeric zero.

Missing, unavailable, unpublished, partial, and no-period states are not zero.

### 3.2 Global physically-backed Gold ETF holdings

Preferred logical series key:

`gold.global_physically_backed_etf_holdings.tonnes`

Meaning:

> Provider-qualified aggregate physical Gold holdings of the global
> physically-backed Gold ETF and similar-product universe at one explicit
> effective date.

Canonical dimensions:

| Dimension | Value |
|---|---|
| legacy Observation domain | `MARKET` |
| marketDomain | `COMMODITY` |
| informationClass | `INVENTORY` |
| jurisdiction | `GLOBAL` |
| instrument | `ETF` |
| asset | `GOLD` |
| unit | `TONNES` |

Holdings must not be classified as `FLOW` merely because the difference
between two holdings observations can later be calculated.

A holdings delta is a deterministic derived metric unless the provider itself
publishes it as a qualified demand/flow measure.

## 4. Universe

The v0.1 target universe is:

> The provider-defined global universe of physically-backed Gold ETFs and
> similar regulated products included in its aggregate methodology for the
> relevant effective period.

P365 must preserve, when available:

- provider universe definition;
- constituent funds/products;
- geography;
- effective date;
- methodology/version;
- inclusion/exclusion changes;
- fund closures/launches;
- whether closed-end funds or mutual funds are included;
- currency conversion methodology;
- flow methodology.

P365 must not silently equate:

- global physically-backed Gold ETF universe;
- US-listed Gold ETFs;
- GLD alone;
- any single issuer's product set.

A single-fund series may become separately useful later, but it is not a
substitute for this global aggregate contract.

## 5. Time semantics

### Flow

The source must state the measurement period explicitly: daily, weekly, monthly,
or another defined interval.

`observedAt` represents the period/effective date according to the qualified
source methodology.

A period-end anchor is not a publication timestamp.

### Holdings

`observedAt` represents the source-qualified holdings effective date.

### Retrieval

`retrievedAt` is the time P365 successfully retrieved the source record.

### Publication/release

`publishedAt` or `releasedAt` may be stored only when the source explicitly
supplies and qualifies such a timestamp.

P365 must never infer publication/release time from:

- website crawl time;
- file modification time;
- a monthly report title;
- US market close;
- scheduler execution time.

Point-in-time reconstruction must remain constrained by P365 retrieval
availability.

## 6. Frequency and intraday boundary

Gold ETF flow/holdings are context/confirmation evidence for an intraday Gold
user, not intraday measurements by default.

A weekly or monthly aggregate may help answer whether medium-horizon investor
demand confirms or contradicts a Gold move, but it must not be presented as
same-session order flow.

No cadence may be upgraded by interpolation or repeated polling.

## 7. Revision semantics

Future runtime must reuse FND-018A Observation identity.

For a given canonical series and effective period:

```text
legacy domain
+ seriesKey
+ normalized observedAt
→ measurement identity
```

A changed factual value for the same measurement creates an append-only
revision.

`retrievedAt` does not enter factual identity.

A metadata-only change does not create a new factual revision.

Provider methodology/universe changes must be retained as provenance and may
require a contract amendment if economic meaning changes materially.

## 8. Missing and zero semantics

Mandatory:

`missing != zero`

The following must fail closed or remain explicitly unavailable:

- blank;
- dash;
- null;
- omitted value;
- malformed number;
- unavailable report;
- authentication/login failure;
- unsupported period;
- incomplete/ambiguous aggregate.

No-session assumptions from exchange calendars may be applied to global
monthly/weekly ETF aggregates unless the provider methodology explicitly
requires them.

## 9. History and read-model requirement

Minimum useful factual history:

- latest qualified flow period;
- previous compatible flow period;
- latest qualified holdings observation;
- previous compatible holdings observation;
- enough durable history for an explicitly approved trend/context question.

There is no hidden universal lookback.

Future point-in-time reads must constrain both effective time and retrieval
availability.

## 10. Source qualification — World Gold Council / Goldhub

### Semantic fit

World Gold Council Goldhub is the strongest audited semantic reference for the
global aggregate target.

Its Gold ETF dataset:

- covers more than 100 physically-backed Gold ETFs and similar products
  worldwide;
- reports regional/fund-specific analysis;
- distinguishes holdings/demand in tonnes from fund flows in USD;
- provides methodology material;
- updates website holdings/flows weekly and monthly;
- provides downloadable Excel data monthly.

This closely matches the desired global aggregate meaning.

### Cadence

The official Goldhub page states:

- weekly website data is updated the following Monday except around monthly
  updates;
- monthly updates are usually available within one week after month-end;
- downloadable Excel data is monthly.

This cadence is compatible with background confirmation/context, but it is not
intraday evidence.

### Access/usage boundary

World Gold Council website Terms permit saving/displaying/printing information
for personal, non-commercial use, but prohibit scraping, copying,
redistribution, derivative use, and other uses without prior written
authorisation except as otherwise permitted.

The dataset also incorporates third-party sources including Bloomberg, company
filings, and ICE Benchmark Administration.

Therefore:

> **WGC/GOLDHUB VERDICT: SEMANTICALLY QUALIFIED REFERENCE — AUTOMATED P365
> RUNTIME NOT AUTHORIZED BY CURRENTLY AUDITED TERMS**

P365 must not scrape or schedule automated ingestion from Goldhub under this
checkpoint.

A later runtime checkpoint requires either:

1. explicit WGC permission/licensing for the intended automated durable use; or
2. a separately qualified provider/API with equivalent semantics and acceptable
   terms.

## 11. Source qualification — SPDR Gold Shares / GLD issuer data

### Semantic fit

The official SPDR Gold Shares site publishes trust information including Gold
ounces/tonnes, shares outstanding, NAV-related information, and an XLSX
historical archive.

Issuer-level GLD holdings can be useful factual evidence for that fund.

However:

- GLD is one fund, not the global physically-backed Gold ETF universe;
- holdings are not the same as provider-reported aggregate USD fund flow;
- using GLD as a hidden proxy for global Gold ETF flow would violate the P365
  source/semantic qualification rule.

### Timing

The official site states trust/share information is updated during the New York
day and the historical archive is updated the next day on the relevant archive
surface.

Those timestamps are issuer-data timing, not a global Gold ETF aggregate
release schedule.

### Usage boundary

The official historical-data disclaimer states the file is for informational
purposes and that reproduction or redistribution is prohibited without prior
written consent.

Therefore:

> **SPDR/GLD VERDICT: QUALIFIED SINGLE-FUND HOLDINGS REFERENCE — NOT A GLOBAL
> FLOW SUBSTITUTE / AUTOMATED DURABLE RUNTIME NOT APPROVED**

No GLD runtime is added by this checkpoint.

## 12. Rejected shortcuts

GOLD-FLOW-001A explicitly rejects:

- deriving global ETF flow from GLD alone;
- classifying GLD holdings change as provider-native global fund flow;
- scraping Goldhub;
- scraping issuer historical files;
- using Gold price change as ETF-flow proxy;
- using COMEX volume/open interest as ETF-flow proxy;
- using CFTC COT as ETF-flow proxy;
- converting monthly/weekly evidence into synthetic daily rows;
- carrying forward the last flow value across unpublished periods.

## 13. Source decision

No audited free-first source currently satisfies all of:

- correct global aggregate semantics;
- explicit time/period semantics;
- sufficient historical continuity;
- reproducible automated access;
- acceptable automated durable-use terms.

Therefore:

> **GOLD-FLOW-001A VERDICT: CONTRACT FROZEN / RUNTIME PROVIDER QUALIFICATION
> OPEN**

This is a valid checkpoint outcome.

The absence of a qualified free-first runtime provider must remain an explicit
gap rather than be filled by a semantically weaker proxy.

## 14. Next gate

Do not implement GOLD-FLOW runtime until a source passes the provider gate.

Possible next actions are:

- obtain explicit WGC/Goldhub automated-use permission;
- qualify a licensed API/provider with equivalent global flow/holdings
  semantics;
- separately progress Gold positioning evidence from an official source such as
  CFTC, under its own checkpoint, without calling positioning a substitute for
  ETF flow.

Any new provider still requires owner approval before runtime integration.

## 15. Out of scope

This checkpoint does not implement:

- provider/runtime code;
- API credentials;
- scheduler;
- backfill;
- Supabase writes;
- derived holdings change;
- trend/z-score/percentile;
- CFTC/COT;
- COMEX OI;
- Gold State/Regime/Risk/Intelligence;
- UI;
- trading signal or recommendation.

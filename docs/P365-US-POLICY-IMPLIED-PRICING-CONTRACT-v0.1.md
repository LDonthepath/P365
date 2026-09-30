# P365 US Policy-Implied Pricing Contract v0.1

**Status:** CONTRACT FROZEN / CME FEDWATCH SEMANTICALLY QUALIFIED / RUNTIME LICENSING OPEN

**Checkpoint:** MACRO-PRICING-001A contract and source qualification

**MVP scope:** Macro explanatory layer for BTC + Gold

**Audit date:** 1 October 2026

## 1. Purpose

This contract defines the missing market-implied US monetary-policy path required by
the P365 Macro → BTC / Gold evidence chain.

It addresses the existing P365 gap:

> OIS / Fed-funds / SOFR-futures implied policy-path coverage is missing, so
> policy-probability repricing claims are not yet permitted.

This checkpoint is documentation/source-qualification only.

It does not add a provider runtime, API credential, dependency, scheduler, durable
writes, derived State/Regime/Risk/Intelligence, UI, or trading logic.

## 2. What this evidence answers

The evidence answers a narrow pricing question:

> At a specific market-pricing timestamp, what FOMC target-rate outcomes did the
> qualified derivatives market imply for a specified future FOMC meeting?

This is:

`RATES / PRICING / US`

It is not:

- the current federal funds target;
- EFFR;
- SOFR;
- the Fed Dot Plot;
- economist consensus;
- a forecast produced by P365;
- a deterministic statement about what the FOMC will do;
- a trading recommendation.

Economic reality, official projections, survey expectations, and market pricing
must remain separate.

## 3. Existing Macro pricing that this checkpoint does not duplicate

P365 already treats market yields and related factual pricing as distinct evidence.

Examples include:

- US nominal Treasury yields;
- 10Y real yield;
- 10Y breakeven inflation;
- DXY and other market prices;
- SOFR/EFFR as factual funding-rate observations where qualified.

Those series are useful pricing/funding inputs, but they do **not** supply the
missing FOMC meeting-by-meeting market-implied policy path.

In particular:

`SOFR spot != SOFR futures path`

`EFFR actual != future FOMC outcome probability`

`Treasury yield != FedWatch meeting probability`

`Fed Dot Plot != derivatives-implied policy pricing`

## 4. Primary canonical evidence — FOMC target-rate probability grid

For each scheduled FOMC meeting and each provider-published target-rate outcome,
P365 requires one provider-native probability observation.

### Canonical series-key scheme

FND-018A Observation identity is based on:

`domain + seriesKey + observedAt`

A single quote timestamp can contain multiple meetings and multiple target-rate
buckets. Therefore meeting identity and target-rate bucket must be part of the
series key so distinct probabilities cannot collide.

Canonical scheme:

`rates.us.fomc.<meeting-date>.target_<lower-bp>_<upper-bp>.probability.pct`

Example shape only:

`rates.us.fomc.2026-10-28.target_350_375.probability.pct`

The example does not assert an actual scheduled meeting or probability.

### Canonical semantic dimensions

- legacy Observation domain: `MARKET`
- marketDomain: `RATES`
- informationClass: `PRICING`
- jurisdiction: `US`
- instrument: `FUTURE`
- asset: none
- tenor/horizon: exact FOMC meeting date
- unit: `PERCENT`

Required metadata/provenance:

- provider;
- provider resource/API;
- FOMC meeting date;
- target lower bound in basis points;
- target upper bound in basis points;
- provider-native probability;
- provider methodology/version where available;
- quote/as-of timestamp;
- retrieval timestamp;
- underlying market family;
- attribution required by provider terms.

Probability is expected on a bounded 0–100 percent scale.

Missing, omitted, unavailable, or malformed probability is not zero.

## 5. Secondary lower-level evidence — Fed Funds futures pricing

Where licensing permits, P365 may also retain provider-native 30-Day Fed Funds
futures pricing that underlies the policy path.

Candidate canonical families include:

`rates.us.fed_funds_futures.<contract-month>.price`

and, only where the provider explicitly supplies it:

`rates.us.fed_funds_futures.<contract-month>.implied_avg_effr.pct`

The contract month must be part of the series key because multiple contracts are
simultaneously priced at one observation timestamp.

Raw futures prices and provider-native implied average EFFR must remain distinct
from FOMC outcome probabilities.

P365 must not silently recompute FedWatch probabilities from futures prices in the
raw factual layer.

Any P365-computed probability tree is a methodology-governed derived metric and
requires a separate checkpoint.

## 6. CME FedWatch semantic qualification

CME FedWatch is the strongest audited semantic match for the required policy-path
evidence.

Official CME documentation states that:

- FedWatch tracks probabilities of FOMC rate changes;
- the probabilities are implied by 30-Day Fed Funds futures prices;
- each upcoming FOMC meeting can be viewed as a probability distribution across
  possible target-rate outcomes;
- the tool provides current and historical probabilities;
- historical probability data are available for a selected meeting;
- CME publishes an explicit probability-tree methodology;
- CME offers a FedWatch REST API for integrating the tool's data into systems.

CME's methodology also makes clear that these are modelled market-implied
probabilities subject to assumptions, including 25 bp policy increments and
relationships between Fed Funds futures-implied average EFFR and meeting-month
outcomes.

Therefore the canonical information class is:

`PRICING`

not:

`EXPECTATION` from a survey or analyst consensus.

### Source verdict

> **CME FEDWATCH: SEMANTICALLY QUALIFIED PRIMARY SOURCE FOR US FOMC
> MARKET-IMPLIED POLICY PRICING**

## 7. CME access and licensing boundary

Semantic qualification does not equal runtime authorization.

CME's public website Data Terms restrict automated extraction/systematic retrieval
and prohibit using website data to build software, archived/cached datasets, or
derived products without permission.

CME separately offers:

- a FedWatch API;
- market-data APIs;
- internal non-display licensing;
- historical/real-time/delayed market-data licensing.

CME's licensing documentation explicitly treats system/process/program use for
research, analysis, risk management, or other non-display purposes as licensable
use.

P365 therefore must not:

- scrape the FedWatch webpage;
- scrape delayed CME futures quote pages;
- archive website-extracted CME market data;
- reverse-engineer hidden website endpoints;
- assume that personal/non-commercial webpage access authorizes automated durable
  ingestion.

A future runtime requires a confirmed API entitlement/license whose permitted use
covers P365's intended internal automated durable storage and analysis.

Current verdict:

> **RUNTIME PROVIDER NOT YET APPROVED — CME API ENTITLEMENT / LICENSING MUST BE
> CONFIRMED FIRST**

## 8. FedWatch API versus webpage

The preferred future source path is the documented FedWatch API, not webpage
scraping.

Runtime qualification must verify:

1. exact API product/resource;
2. authentication method;
3. entitlement status;
4. rate limits;
5. response schema;
6. quote/as-of timestamp semantics;
7. meeting-date semantics;
8. target-rate bucket semantics;
9. current versus historical availability;
10. permitted storage/retention;
11. permitted internal non-display use;
12. attribution requirements;
13. whether probabilities are provider-native or require client-side calculation.

No secret/API key may be placed in client code.

## 9. New York Fed / FRED boundary

The New York Fed publishes factual reference rates such as EFFR and SOFR. FRED
also distributes qualified factual rate series including SOFR and market-pricing
series such as 10Y breakeven inflation.

These sources are valuable Macro inputs but do not replace derivatives-implied
FOMC meeting probabilities.

They may support later methodology validation, for example current EFFR anchors,
but P365 must not manufacture a policy-probability distribution from spot SOFR,
EFFR, Treasury yields, or breakevens without an explicit methodology checkpoint.

Therefore:

> **NY FED / FRED: QUALIFIED SUPPORTING FACTUAL SOURCES — NOT A SUBSTITUTE FOR
> THE MISSING POLICY-IMPLIED PATH**

## 10. Time semantics

Policy pricing has at least three separate times:

1. **quote/as-of time** — when the market-implied probability grid applies;
2. **target meeting date** — the future FOMC meeting being priced;
3. **retrievedAt** — when P365 successfully received the provider response.

These must never be collapsed.

For canonical FND-018A identity:

- `observedAt` = qualified provider quote/as-of timestamp;
- meeting date belongs to series identity and metadata;
- `retrievedAt` = P365 acquisition time.

If a provider response lacks a qualified quote/as-of timestamp, P365 must not
silently promote retrieval time into market quote time.

Such a response remains runtime-unqualified until its time semantics are explicit.

## 11. Historical and point-in-time requirements

For valid repricing analysis P365 eventually needs probability grids both before
and after a catalyst.

Minimum useful historical record:

- exact quote/as-of timestamp;
- exact FOMC meeting date;
- exact target-rate bucket;
- probability;
- provider/source lineage;
- retrieval availability.

Point-in-time reads must constrain both:

- market quote time;
- P365 retrieval availability.

A later snapshot must not retroactively replace an earlier pre-event probability
grid.

Corrections or provider restatements must remain append-only under the existing
FND-018A factual revision rules.

## 12. Snapshot / repricing integration boundary

Future qualified policy pricing may participate in PRC/Snapshot/RPR only after
runtime activation.

A pre/post comparison may answer:

> Did the probability distribution across specified FOMC outcomes change around
> the event?

It may not answer, without a separate methodology:

- whether the event caused the repricing;
- whether the Fed will choose the most probable outcome;
- whether BTC or Gold must move in a specified direction.

Cross-asset transmission remains governed separately.

## 13. Derived summaries

The following are **not** provider-native raw facts unless explicitly supplied by
the qualified provider:

- probability of any cut;
- probability of any hike;
- expected number of cuts;
- expected terminal rate;
- weighted expected target rate;
- cumulative easing/tightening in basis points;
- policy-path slope;
- hawkish/dovish score.

When computed by P365 they are deterministic or model-dependent derived outputs and
require explicit methodology/version/input lineage.

MACRO-PRICING-001A does not authorize them.

## 14. Source decision

The source audit yields:

### CME FedWatch

- semantic fit: **PASS**
- explicit methodology: **PASS**
- historical/current probability concept: **PASS**
- documented system API: **PASS**
- free webpage automated durable use: **FAIL**
- P365 API licensing/entitlement: **UNVERIFIED**

### New York Fed / FRED

- official/factual rates: **PASS**
- policy-probability path: **FAIL — not the same data class**

### Checkpoint verdict

> **MACRO-PRICING-001A: CONTRACT FROZEN / CME FEDWATCH SEMANTICALLY QUALIFIED /
> RUNTIME LICENSING OPEN**

This is an explicit gap, not permission to substitute a weaker proxy.

## 15. Runtime gate

Do not implement MACRO-PRICING-001B until CME API access is approved for the
P365 internal automated use case.

A future runtime must prove at minimum:

1. documented FedWatch API only; no website scraping;
2. server-only credentials;
3. entitlement/license explicitly compatible with intended use;
4. exact response-envelope/schema validation;
5. qualified quote/as-of time;
6. meeting date and target-rate bounds retained in identity/provenance;
7. probabilities bounded to 0–100;
8. per-meeting probability sum validated within provider-appropriate rounding
   tolerance;
9. missing is not zero;
10. provider errors fail closed;
11. no retrieval-time substitution for quote time;
12. unchanged facts are idempotent;
13. changed factual probabilities append as revisions;
14. point-in-time reads are retrieval-aware;
15. bounded history/backfill;
16. no derived cut-count/terminal-rate/hawkish-dovish metric in the raw layer;
17. no UI/reasoning/trading signal in the factual runtime checkpoint.

## 16. Out of scope

- CME API purchase/entitlement;
- runtime/provider code;
- website scraping;
- SOFR futures runtime;
- OIS provider expansion;
- policy-path derived summaries;
- production scheduler;
- backfill;
- UI;
- State/Regime/Risk/Intelligence;
- trading signal/recommendation.

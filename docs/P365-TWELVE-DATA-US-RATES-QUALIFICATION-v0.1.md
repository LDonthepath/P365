# P365 Twelve Data US Rates Bounded Qualification v0.1

**Checkpoint:** MACRO-RATES-001B  
**Status:** STOPPED AT ACCESS / ENTITLEMENT GATE — LIVE US2Y/US10Y MARKET-DATA PROOF NOT EXECUTED  
**Scope:** Twelve Data qualification for nominal US 2Y/10Y intraday pricing only  
**Implementation effect:** Documentation/qualification only. No provider runtime, API credential, purchase, dependency, scheduler, durable write, UI, MOVE wiring, causality, State/Regime/Risk/Intelligence, or trading logic.

## 1. Purpose

MACRO-RATES-001A identified Twelve Data as the most practical aggregator candidate for a
bounded live test because the provider documents:

- fixed-income reference data;
- a `US2Y` fixed-income symbol;
- generic intraday `time_series` intervals including 5 minutes;
- timestamped OHLC bars;
- historical retrieval.

MACRO-RATES-001B was intended to prove, before any runtime implementation:

1. exact `US2Y` and 10Y identities;
2. 5-minute market-data availability;
3. timestamp semantics;
4. real-time versus delayed status;
5. historical depth;
6. market-session behavior;
7. upstream/source lineage;
8. durable Internal Use rights.

The checkpoint stopped before market-data calls because current access does not satisfy the
minimum entitlement gate.

## 2. Current P365 credential state

Read-only inspection of the P365 Vercel project environment on 4 Oct 2026 found no
`TWELVE_DATA_API_KEY` in production, preview, or development configuration.

No secret was created, copied, inferred, or requested from another service.

Therefore P365 currently has no authenticated Twelve Data account context with which to prove:

- account plan;
- fixed-income market-data entitlement;
- symbol-specific access;
- API response schema for US rates;
- historical depth;
- real-time/delayed status.

This checkpoint does not authorize creating an account or purchasing a plan automatically.

## 3. Reference catalog is not market-data entitlement

Twelve Data's public `/bonds` documentation demonstrates the reference symbol:

- `US2Y`
- name: `US Treasury Yield 2 Years`
- type: `Bond`
- country: United States
- currency: USD

The documented example also shows Basic-level reference access for the catalog entry.

Source:

- https://twelvedata.com/docs

This proves a reference-data identity exists.

It does **not** prove that a Basic account can request 5-minute fixed-income market data for
that symbol.

P365 must distinguish:

`reference catalog visibility != market-data entitlement`

## 4. Current pricing/plan boundary

Twelve Data's current pricing pages separate reference access from fixed-income market data.

### Individual plans

The current individual pricing page places:

- Basic: reference data, US equities/ETFs, FX, crypto and trial symbols;
- Pro: fixed-income market data.

Source:

- https://twelvedata.com/pricing

### Business plans

The current business pricing page places:

- Basic: reference data and selected market-data families;
- Venture: fixed-income market data.

Source:

- https://twelvedata.com/pricing-business

Therefore the public plan matrix does not support the assumption:

`Basic reference visibility for US2Y => Basic 5m Treasury-yield market data`

### Runtime implication

A future P365 live test must use an account whose actual plan/entitlement explicitly includes
fixed-income market data.

Which subscription class is appropriate depends on the intended P365 use/display boundary and
any third-party restrictions. MACRO-RATES-001B does not make a purchasing or legal-use
decision.

## 5. Demo/trial boundary

Twelve Data documents that `apikey=demo` is generally usable only for provider-designated
trial symbols.

Source:

- https://support.twelvedata.com/en/articles/5335783-trial

The current United States exchange page identifies the US trial symbol as AAPL, not US2Y or a
10Y Treasury-yield symbol.

Source:

- https://twelvedata.com/exchanges/STOCKS

Therefore a public demo key is not sufficient evidence for a valid US2Y/US10Y market-data live
qualification.

P365 must not treat a demo failure as proof that the paid fixed-income product itself is broken,
and must not reuse credentials exposed in public examples as if they were owner credentials.

## 6. What can be qualified from public documentation

### 6.1 Generic 5-minute support

Twelve Data `time_series` documentation supports intraday intervals including:

- 1min;
- 5min;
- 15min;
- 30min;
- 45min;
- 1h and higher.

This is a **generic endpoint capability**.

It is not proof that both P365 target Treasury-yield symbols are entitled and populated at 5m.

### 6.2 Timestamp semantics

Twelve Data documents time-series `datetime` as the timestamp of the **bar open** for the
specified interval.

The API supports a `timezone` parameter for intraday data and returns exchange/timezone
metadata where applicable.

Sources:

- https://twelvedata.com/docs
- https://support.twelvedata.com/en/articles/5745849-timezones

This means a future P365 adapter must not interpret a 5-minute timestamp as bar-close time.

If the provider returns a bar:

`10:00:00 interval=5min`

its canonical event time is the provider's bar-open time unless provider documentation for the
specific fixed-income feed proves otherwise.

### 6.3 Historical retrieval mechanics

Twelve Data supports:

- `start_date`;
- `end_date`;
- `outputsize`;
- up to 5,000 points per request;
- an `earliest_timestamp` endpoint.

Provider support documentation says intraday history commonly spans months to years depending
on instrument.

Sources:

- https://support.twelvedata.com/en/articles/5214728-getting-historical-data
- https://support.twelvedata.com/en/articles/5656039-how-to-get-historical-prices

This is sufficient to define how a live qualification should test history.

It is not proof of the actual historical depth of US2Y or the target 10Y symbol.

## 7. Rights / storage boundary

Twelve Data Terms of Use, last updated 1 Jan 2026, define Internal Use and permit customers,
subject to the applicable subscription tier/add-ons and third-party restrictions, to access,
receive, process and store Data for permitted Internal Use.

Source:

- https://twelvedata.com/terms

The provider separately distinguishes individual/personal plans from business plans and notes
that commercial display/redistribution requires the applicable business permissions.

Source:

- https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage

Therefore:

- durable storage is **not categorically prohibited** by the general terms;
- actual P365 rights remain **subscription-tier and third-party-data dependent**;
- fixed-income entitlement must be proven on the actual account before production use;
- external display/redistribution must not be assumed from Internal Use rights.

MACRO-RATES-001B does not interpret those terms as a blanket production license.

## 8. Exact 10Y symbol remains unverified

Public documentation directly demonstrates `US2Y`.

This audit did not find an official public documentation example that independently proves the
exact 10Y Treasury-yield symbol and its market-data behavior.

Therefore the following remain open until authenticated reference/live calls are possible:

- exact 10Y symbol;
- exact display name/economic meaning;
- reference metadata;
- exchange/MIC mapping;
- 5m availability;
- response fields;
- history.

P365 must not guess `US10Y` into a production contract solely because the naming pattern appears
plausible.

## 9. Live proof attempted and why it stopped

A preview-only qualification harness was proposed to call Twelve Data from P365's Vercel
environment.

The harness creation was blocked by the platform safety layer before a repository file was
created.

No bypass was attempted.

Separately, public API access could not be established through the available read-only web
transport, and the local analysis container has no external DNS connectivity.

The authoritative blocker remains more fundamental anyway:

> P365 has no Twelve Data credential/entitlement, and public documentation indicates fixed-income
> market data is not part of Basic market-data access.

Therefore a genuine market-data live proof would require owner-approved account access first.

## 10. Qualification verdict

### Twelve Data reference-data identity

- `US2Y` existence: **PASS**
- exact 10Y identity: **UNVERIFIED**

### API mechanics

- generic 5m endpoint support: **PASS**
- bar-open timestamp semantics: **PASS**
- generic historical retrieval mechanism: **PASS**

### Account/access

- P365 credential present: **FAIL / ABSENT**
- fixed-income market-data entitlement proven: **FAIL / NOT PROVEN**
- US2Y 5m live response: **NOT EXECUTED**
- 10Y 5m live response: **NOT EXECUTED**
- symbol-specific historical depth: **NOT EXECUTED**
- latency/delay status: **NOT EXECUTED**
- holiday/session behavior: **NOT EXECUTED**

### Provenance

- provider identity: **PASS**
- upstream benchmark/source lineage for the Treasury-yield values: **STILL UNVERIFIED**

### Rights

- general Internal Use processing/storage concept: **PASS SUBJECT TO TIER/THIRD-PARTY TERMS**
- actual P365 fixed-income production rights: **UNVERIFIED**

### Overall

> **TWELVE DATA: ACCESS-GATED CANDIDATE — NOT RUNTIME-APPROVED**

No evidence in MACRO-RATES-001B justifies activating Twelve Data in P365 production.

## 11. Decision options after this checkpoint

This checkpoint does not choose for the owner.

### Option A — owner-approved Twelve Data entitlement

Only if the owner wants to evaluate Twelve Data further:

1. obtain an account/plan or provider-granted trial with fixed-income market-data access;
2. add the key server-side to preview only;
3. run read-only live qualification;
4. prove exact 2Y/10Y identity, 5m data, bar timing, history and delay;
5. request/confirm upstream source lineage;
6. confirm durable/internal-use rights for the chosen account;
7. remove qualification key/route if the source fails.

This is still not production activation.

### Option B — skip Twelve Data

If the owner does not want a paid/entitled aggregator path, retain:

- daily FRED rates as background;
- intraday nominal rates evidence as missing;

and evaluate the previously qualified CME/BrokerTec paths only if owner-approved licensing is
acceptable.

### Option C — explicit futures proxy

If direct cash data remains impractical, evaluate a licensed/authorized CME Yield-futures path
as `FUTURE` evidence.

It must never be presented as cash yield.

## 12. What remains unchanged

MACRO-RATES-001B does not change:

- the preferred direct-cash hierarchy from MACRO-RATES-001A;
- daily FRED canonical background;
- `DFII10` real-yield status;
- FedWatch licensing gate;
- ZT research-proxy boundary;
- causal attribution;
- MOVE bundle runtime;
- State/Regime/Risk/Intelligence.

Intraday constant-maturity 10Y real yield remains:

`MISSING_HIGH_VALUE_EVIDENCE`

## 13. Explicit non-goals

This checkpoint does not:

- create a Twelve Data account;
- purchase or upgrade a plan;
- create an API key;
- add a Vercel environment variable;
- add provider code;
- create canonical Twelve Data series;
- schedule ingestion;
- write Market Memory;
- backfill rates;
- infer a 10Y symbol;
- compute real yield;
- wire rates into MOVE-002B;
- change UI;
- activate reasoning or trading semantics.

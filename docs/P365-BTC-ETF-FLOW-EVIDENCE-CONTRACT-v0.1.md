# P365 US Spot Bitcoin ETF Daily Net Flow Evidence Contract v0.1

**Status:** **CONTRACT DEFINED — PROVIDER QUALIFICATION OPEN**

**Checkpoint:** CRYPTO-FLOW-001A source qualification

**Canonical series key:** `crypto.us_spot_btc_etf_net_flow.usd`

**Runtime status:** **MISSING / BLOCKED PENDING SOURCE GATES**

**Primary candidate verdict:** **SoSoValue CONDITIONAL CANDIDATE — API USE PERMISSION AND FINALITY/UNIVERSE SEMANTICS REQUIRE CLARIFICATION**

**Audit date:** 30 September 2026

## 1. Purpose

This document freezes the factual meaning, semantic classification, time rules, revision behavior, and source-qualification boundary for US spot Bitcoin ETF daily net flow. It evaluates SoSoValue as the free-first candidate and Farside and CoinGlass as references or fallbacks.

This checkpoint does not authorize provider integration, credentials, normalization, ingestion, persistence, scheduling, UI, or reasoning. CRYPTO-FLOW-001B remains blocked because no audited source currently passes every runtime gate.

## 2. Reasoning question

The metric answers only:

> What was the net daily capital flow into or out of the qualified US spot Bitcoin ETF universe on a given trading date?

It does not answer whether BTC is bullish or bearish, whether institutions are accumulating, whether ETF flow caused a BTC move, whether flow predicts future returns, or whether ETF demand confirms a trade.

## 3. Terminology boundaries

For this contract:

- **daily net flow** is the source-reported aggregate net USD inflow/outflow for one qualified US ETF trading date;
- positive means provider-reported net inflow;
- negative means provider-reported net outflow;
- zero is valid only when the provider explicitly reports factual numeric zero;
- missing, pending, partial, unavailable, and no-session are not zero;
- ETF net flow is not ETF AUM, ETF holdings, BTC price, ETF trading volume, issuance, a participant classification, or an institutional-intent claim;
- a completed prior-session fact may provide background for an intraday BTC user, but it is not an intraday measurement.

## 4. Canonical metric

| Dimension | Frozen value |
|---|---|
| Logical series key | `crypto.us_spot_btc_etf_net_flow.usd` |
| Meaning | Aggregate daily net USD inflow/outflow for the qualified US spot Bitcoin ETF universe |
| Legacy `ObservationDomain` | `MARKET` |
| Canonical unit | `USD` |
| Sign convention | positive inflow; negative outflow; provider-explicit zero only |
| Cadence | US ETF trading session / trading date |

If a source reports USD millions, normalization must multiply the exact source value by `1,000,000` using decimal-safe arithmetic and retain the source scale in provenance. The conversion changes scale only, not economic meaning.

## 5. Semantic classification

The existing ontology and runtime vocabulary already support the required dimensions:

| Axis | Frozen value |
|---|---|
| `ontologyVersion` | `v0.1` |
| `marketDomain` | `CRYPTO` |
| `informationClass` | `FLOW` |
| `jurisdiction` | `US` |
| `instrument` | `ETF` |
| `asset` | `BTC` |
| unit | `USD` |

This source-reported aggregate remains `FLOW`. It must not be classified as `OBSERVATION`, `PRICING`, `POSITIONING`, `DERIVED_STATE`, or `DERIVED_METRIC`. A later implementation using a P365-computed constituent sum would require an explicit methodology amendment rather than silently retaining provider-native semantics.

## 6. Universe

The v0.1 universe is methodological rather than a permanently hardcoded ticker count:

> US-listed spot Bitcoin ETFs included by the qualified provider in its canonical US spot BTC ETF aggregate for the relevant effective date.

The universe excludes Hong Kong products, Bitcoin futures ETFs, leveraged/inverse ETFs, and closed-end or other products unless the selected provider explicitly includes them in the documented US spot-ETF aggregate and P365 separately approves that interpretation.

A future runtime must preserve, when exposed:

- the constituent ticker set applicable to the effective date;
- aggregate completion/update status;
- provider methodology or version;
- inclusion/exclusion changes and their effective dates;
- treatment of conversions and related products, including GBTC and newer mini trusts.

The SoSoValue API can return a current `symbol=BTC&country_code=US` ETF list, but the audited documentation does not make that list effective-dated or expose universe/methodology versions. It also does not explicitly document treatment of GBTC and mini trusts within the historical aggregate. A new ETF must therefore not enter runtime history as an invisible methodology change.

## 7. Provider-native vs derived methodology

The preferred canonical value is a provider-native aggregate. SoSoValue documents `total_net_inflow` as the total net inflow of all ETFs for the requested day. CoinGlass documents aggregate `flow_usd`. Farside publishes a provider-generated `Total` column.

P365 must not sum constituent funds when a qualified provider-native aggregate is available.

If a later checkpoint must use deterministic P365 aggregation, it requires a new methodology version defining:

- exact effective-dated constituent inclusion;
- missing and pending constituent behavior;
- partial-day behavior and completion criteria;
- decimal/scale rules;
- revision behavior;
- aggregate quality when one or more constituents are unavailable.

## 8. Time semantics

ETF flow is a daily trading-session fact.

### `observedAt`

Use the provider-qualified trading/effective date. If the provider supplies only `YYYY-MM-DD`, P365 may anchor it deterministically as `YYYY-MM-DDT00:00:00.000Z` solely as the canonical effective-date timestamp. That anchor is not a release time, publication time, NYSE close, or intraday flow timestamp. Preserve the original date separately in provenance.

### `retrievedAt`

Use the timestamp when P365 successfully acquires the provider response. It is the point-in-time availability boundary for P365.

### `releasedAt` / `publishedAt`

Leave undefined unless the provider explicitly supplies and qualifies the corresponding timestamp.

Flow for trading date T may become knowable only after the session and after progressive fund reporting. Point-in-time reconstruction must constrain `retrievedAt`; it must never assume the completed value was knowable at the market close or at the effective-date anchor.

## 9. Partial/final semantics

> Partial, estimated, pending, or otherwise non-qualified-complete ETF flow aggregates **MUST NOT** be persisted as canonical `crypto.us_spot_btc_etf_net_flow.usd` Observations.

The v0.1 canonicalization boundary is:

```text
PARTIAL / ESTIMATED / PENDING / otherwise non-qualified-complete
→ not canonicalized

qualified FINAL / COMPLETE
→ canonical Observation

later changed canonical factual value
→ append-only factual revision under FND-018A
```

Provider-stage partial data may exist transiently during acquisition, but it is not a canonical factual Observation under this v0.1 contract.

If finality changes while the numeric value remains identical, no new factual revision exists under FND-018A. This is why v0.1 excludes partial values from canonical persistence. A future product requirement for durable partial-state history when the numeric value is unchanged requires a separate contract/record family or an explicit identity-evolution checkpoint; it is not solved here.

The audited SoSoValue summary response contains `date`, `total_net_inflow`, `total_value_traded`, `total_net_assets`, and `cum_net_inflow`, but no completion/finality field. Its current ETF list is also not effective-dated. The public SoSoValue dashboard displays an update-status concept, but the official summary-history API contract does not expose it. Consequently, P365 cannot prove from the API response that a same-day aggregate is complete.

Farside states that its table updates in real time, typically during the US evening/night, but exposes no machine finality field. CoinGlass's audited endpoint also exposes no finality field. Runtime must fail closed rather than persist a same-day aggregate as indistinguishable from final. A policy based only on waiting until a guessed clock time is not authorized.

## 10. Historical semantics

Immediate factual needs are:

- latest qualified completed trading-date flow;
- previous trading-session flow;
- a factual five-session/approximately one-week context where explicitly requested.

Select actual trading-date observations. Weekends and exchange holidays are not missing observations and must not receive fabricated zero rows. Do not interpolate or forward-fill.

SoSoValue's official summary-history documentation supports `start_date`, `end_date`, and `limit`, excludes weekends/holidays, sorts latest first, and limits queries to the most recent one month. This is sufficient in depth for the immediate prior-session and five-session factual questions, but not for long-history baselines. History depth alone does not overcome the unresolved finality, universe, and permission gates.

## 11. Revision semantics

Reuse the existing Observation identity contract:

```text
MARKET
+ crypto.us_spot_btc_etf_net_flow.usd
+ observedAt
→ measurement identity
```

A changed canonical factual value for the same measurement creates a distinct revision fingerprint and a new append-only Observation. `retrievedAt` remains knowledge/availability time and must not enter the factual revision identity.

Under FND-018A, the revision fingerprint covers the measurement identity, source, canonical factual value, unit, and frequency. Finality metadata alone does not create a new Observation revision. For the same measurement, a later changed canonical factual value creates a new append-only factual revision; an identical value with a changed finality label does not.

Only qualified completed/final values enter this canonical series, and later factual corrections must never overwrite earlier Market Memory rows. Preserve an explicit provider finality/revision field on the accepted canonical final Observation if one becomes available. None of the three audited sources documents a canonical vintage/revision identifier for this metric.

## 12. Missing/zero rules

`missing != zero` is mandatory.

The following must not become zero without an explicit provider definition:

- blank, dash, `null`, omitted, non-numeric, or malformed aggregate values;
- missing or pending constituent values;
- incomplete aggregate;
- provider outage/error;
- market holiday or no trading session.

Farside's table visibly uses both `0.0` and `-`; therefore they are not interchangeable representations. Only a numeric provider-reported aggregate zero is a factual zero.

## 13. Provenance requirements

A future canonical Observation must retain at minimum:

- stable P365 source ID;
- credential-free provider resource path;
- exact canonical series/metric identity;
- request universe parameters such as `symbol=BTC` and `country_code=US`;
- original trading/effective date and deterministic canonical anchor;
- original unit/scale and any USD conversion rule;
- provider-native aggregate field name;
- retrieval timestamp;
- completion/finality metadata on the accepted canonical final Observation when available;
- effective-date constituent tickers and methodology/version when available.

Finality/completion metadata may be retained on the accepted canonical final Observation when the provider supplies it. A status-only transition does not automatically create a separate Observation revision under FND-018A.

Do not fabricate native instrument IDs, publication/release timestamps, constituent completeness, or methodology versions. Provider identity remains provenance and must not enter the logical series key.

## 14. Freshness/session semantics

This metric must use US ETF trading-session semantics, not a 24/7 crypto calendar and not generic wall-clock daily freshness.

A future read model may treat only the latest qualified completed trading session as current background. It must distinguish:

- completed latest session;
- pending current-session/same-day aggregate;
- stale provider history relative to expected trading sessions;
- holiday/weekend no-session;
- unknown exchange/session status.

Exact session calendar, finality, and acquisition-lag policy must be qualified in CRYPTO-FLOW-001B. This document does not invent a close or publication time.

## 15. SoSoValue qualification

### Official API mapping

The current [SoSoValue developer surface](https://sosovalue.com/developer) advertises RESTful JSON access, crypto ETF data, a zero-cost Demo plan, and a Beta limit of 20 calls/minute. The current official [Market Data documentation](https://sodex.com/documentation/for-developers/developers/data-api) is hosted under the SoDEX documentation surface and uses base URL `https://openapi.sosovalue.com/openapi/v1`. Its [authentication and limits contract](https://sodex.com/documentation/for-developers/developers/data-api/authentication-and-limits) specifies the API-key header and quotas below.

| Item | Audited contract |
|---|---|
| Method | `GET` |
| Aggregate resource | `/etfs/summary-history` |
| Authentication | server-side `x-soso-api-key` header |
| Required query | `symbol=BTC`, `country_code=US` |
| Optional query | `start_date`, `end_date`, `limit` |
| Aggregate field | `total_net_inflow` |
| Unit | USD |
| Date field | `date`, trading date `yyyy-MM-dd` |
| Ordering | reverse chronological |
| Non-trading days | excluded |
| History range | most recent one month |
| Limit | default 50, maximum 300 |
| Current constituent list | `GET /etfs?symbol=BTC&country_code=US` |
| Per-fund history | `GET /etfs/{ticker}/history`, field `net_inflow` |
| Published request limits | 100,000/month and 20/minute in current auth/limits docs |

The exact provider-native mapping is:

```text
GET https://openapi.sosovalue.com/openapi/v1/etfs/summary-history
    ?symbol=BTC
    &country_code=US

response date             → provider effective trading date
response total_net_inflow → canonical USD daily net flow candidate
```

The endpoint and field are documented and immediate history depth is sufficient. However:

- the aggregate response exposes no partial/final/update status;
- the ETF list is current, not effective-dated;
- historical universe and methodology revisions are not exposed;
- GBTC/mini-trust treatment is not explicitly defined in the API contract;
- documentation is internally imperfect: common definitions describe a common response envelope while ETF endpoint examples show bare arrays;
- actual Demo-key entitlement to the ETF endpoints was not exercised because this docs-only checkpoint does not create credentials.

### Terms and permission boundary

The [Terms linked from the SoSoValue developer page](https://sosovalue-white-paper.gitbook.io/sosovalue-whitepaper/9.-resources/9.4-terms-of-use.md) currently resolve through a moved SoSoValue whitepaper page governing a website, not a separate Market Data API licence. Those terms limit website use to personal/non-commercial use and prohibit automated website access/copying and redistribution. Official authenticated API calls are not website scraping, but the audited terms do not clearly grant storage, repeated automated API ingestion, or durable internal reuse of API data.

The newer SoDEX Terms likewise govern its interface and permit personal/non-commercial use; they do not provide a clear API-data licence for P365. No audited API-specific permission resolves this ambiguity.

Verdict:

> **CONDITIONAL CANDIDATE — API USE PERMISSION AND FINALITY/UNIVERSE SEMANTICS REQUIRE CLARIFICATION**

SoSoValue is technically the strongest free-first candidate, but it is not runtime-ready. Written clarification or explicit API terms must cover automated authenticated acquisition, internal durable storage, and intended non-commercial MVP use. Runtime also needs a qualified completion/finality and effective-dated universe policy.

## 16. Farside assessment

The official [Farside Bitcoin ETF flow table](https://farside.co.uk/btc/) provides:

- daily US spot Bitcoin ETF flows;
- per-fund values and a provider-generated `Total`;
- USD millions;
- history from launch through an all-data table;
- real-time progressive updates, typically during the US evening/night;
- visible treatment of GBTC and the newer Grayscale mini trust `BTC` in the current table.

Limitations:

- the audited official site exposes a public HTML table, not an official machine-readable API;
- no explicit automated-access or data-reuse licence was found on the official ETF, privacy, or site navigation pages;
- all-rights-reserved copyright is displayed;
- no machine completion/finality, revision/vintage, or methodology-version field is exposed;
- progressive updates mean historical corrections may occur, but no revision contract is documented;
- dash and numeric zero both appear and must not be conflated.

Verdict:

> **REFERENCE SOURCE / RUNTIME LICENSING-AUTOMATION UNQUALIFIED**

Farside may be used for manual/reference comparison, but P365 must not scrape it or qualify it for runtime merely because its table is useful.

## 17. CoinGlass assessment

The official [CoinGlass ETF Flows History](https://docs.coinglass.com/reference/etf-flows-history) endpoint documents:

| Item | Audited contract |
|---|---|
| Method/resource | `GET https://open-api-v4.coinglass.com/api/etf/bitcoin/flow-history` |
| Authentication | `CG-API-KEY` header |
| Aggregate | `flow_usd` |
| Per-fund breakdown | `etf_flows[].etf_ticker`, `etf_flows[].flow_usd` |
| Date/time | `timestamp`, milliseconds |
| Unit | USD |
| Plans | Hobbyist, Startup, Standard, Professional, Enterprise |

Current [CoinGlass pricing](https://www.coinglass.com/pricing) lists Hobbyist at USD 29/month, 30 requests/minute, personal use, and all-time daily history. Commercial use begins at the Standard tier, currently USD 299/month. No purchase or subscription was made.

The endpoint is technically suitable in aggregate/per-ticker shape and history depth, but its documentation does not expose aggregate finality or effective-dated universe/methodology fields. Under P365's free-first requirement it is not the primary candidate.

Verdict:

> **TECHNICALLY QUALIFIED / NOT FREE-FIRST — PAID PLAN AND FINALITY/UNIVERSE GATES REMAIN**

## 18. Licensing/use boundary

No source is approved for public redistribution, dataset republication, resale, external API exposure, or commercial P365 use.

SoSoValue's free Demo availability is not itself a licence grant. Farside has no verified automation/reuse permission. CoinGlass explicitly separates personal-use lower plans from commercial-use plans and is paid.

This is a source-qualification record, not legal advice. Any later permission must be recorded from the provider's then-current API-specific terms or written authorization. P365 must not claim ownership of provider data.

## 19. Runtime gate

> The selected provider/policy must allow P365 to determine that a daily aggregate is qualified complete **before** canonical persistence.

CRYPTO-FLOW-001B may begin only after all of these are satisfied:

1. exact endpoint and fields are re-verified;
2. free-plan historical coverage is confirmed with an authorized key;
3. provider universe semantics and GBTC/mini-trust treatment are explicit;
4. qualified completion is determinable from an explicit provider finality field or an authoritative completion policy;
5. trading-date/time semantics are qualified;
6. missing/zero behavior is known;
7. append-only revisions can be preserved;
8. automated API acquisition and durable internal storage are permitted;
9. internal/non-commercial MVP use is permitted;
10. the owner explicitly approves the selected provider.

If a provider exposes no explicit finality field, CRYPTO-FLOW-001B remains blocked until an authoritative completion policy is qualified. A guessed wall-clock delay is insufficient.

At CRYPTO-FLOW-001A close, gates 3, 4, 8, and 9 are unresolved for SoSoValue, and live Demo entitlement under gate 2 has not been exercised. Therefore 001B is blocked.

## 20. Future UI semantics

No UI is authorized by this checkpoint.

A later approved UI may present only factual content such as:

- completed trading date;
- net USD flow with explicit sign;
- source and retrieval/as-of time;
- completed/partial/pending/unknown state through translated labels;
- actual previous-session or five-session context;
- provider universe disclosure.

It must not label flow as bullish/bearish, institutional accumulation, BTC demand, confirmation of a trade, causal price pressure, or a prediction.

## 21. Non-goals

This contract does not implement or authorize:

- provider fetcher, API key, environment variable, or dependency;
- normalization, ingestion, Supabase, Market Memory writes, backfill, or scheduler;
- dashboard/UI;
- cumulative ETF-flow signal or percentile;
- P365 constituent aggregation;
- ETF holdings or AUM series;
- Gold ETF flow;
- confirmation/contradiction or causal BTC interpretation;
- State, Regime, Risk, Intelligence, or trading signals;
- paid subscription;
- website scraping or undocumented endpoint use.

The frozen result is one factual flow contract with provider qualification intentionally left open until permission, finality, and universe semantics are strong enough for durable runtime use.

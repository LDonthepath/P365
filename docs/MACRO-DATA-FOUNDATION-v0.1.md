# Macro Data Foundation v0.1

## [IMPLEMENTED] scope

P365 now ingests free, official macroeconomic data as canonical `MACRO` Observations. Each observation is linked to an `OBSERVATION` Evidence record. This layer records facts only; it does not make macro conclusions.

Flow:

```text
FRED API → FRED provider → Macro normalizer → Evidence + Observation → DashboardData
Federal Reserve FOMC calendar → event normalizer → Evidence + Event → DashboardData
```

## [IMPLEMENTED] providers and source hierarchy

1. FRED (Federal Reserve Economic Data): all P0 measurement series.
2. Board of Governors of the Federal Reserve System: FOMC meeting calendar.
3. Existing Financial Modeling Prep economic-calendar integration remains unchanged for its existing calendar behavior; it is not used for P0 measurements.

No paid provider was introduced.

## [IMPLEMENTED] P0 series registry

The canonical registry is `lib/data/macro-registry.ts`.

| Group | FRED series |
| --- | --- |
| Monetary policy | `FEDFUNDS`, `EFFR`, `WALCL`, `WRESBAL` |
| Liquidity | `M2SL`, `WTREGEN`, `RRPONTSYD` |
| Inflation | `CPIAUCSL`, `CPILFESL`, `PCEPI`, `PCEPILFE` |
| Labor | `UNRATE`, `PAYEMS`, `ICSA` |
| Rates | `DGS2`, `DGS10`, `DFII10` |
| USD | `DTWEXBGS` — canonical subject: **US Broad Trade-Weighted Dollar Index**; this is not DXY. |
| Growth | `GDPC1` |

The registry stores the FRED ID, canonical subject, unit, cadence, freshness window, and server cache duration. FRED-specific wire shapes remain confined to `lib/data/fred.ts`.

## [IMPLEMENTED] dates, metadata, and quality

Observations include `seriesId`, `frequency`, `unit`, `source`, `observationDate`, `releaseDate`, `previousValue`, and `vintageDate` metadata where the provider response permits it.

- `observationDate` is the period measured by FRED.
- `observedAt` is when P365 captured that published record.
- `releaseDate` is retained as `null` in v0.1 because FRED's standard observations response does not reliably provide a per-observation release timestamp. It is never copied from `observationDate`.
- `vintageDate` is populated from FRED `realtime_start` when valid; v0.1 does not implement historical vintage selection.

Invalid dates, future measurement dates, `.`, and non-numeric values do not create Evidence or canonical Observations. The FRED provider also explicitly sorts valid records by `observationDate` descending before selecting the latest value and its `previousValue`; when only one valid period remains, `previousValue` is `null`. A malformed provider response is an `ERROR`, not an empty data result.

## [IMPLEMENTED] freshness and caching

Macro quality uses expected cadence rather than the crypto market 15-minute rule:

| Cadence | Freshness window | Cache |
| --- | ---: | ---: |
| Daily | 5 days | 6 hours |
| Weekly | 14 days | 12 hours |
| Monthly | 45 days | 12 hours |
| Quarterly | 135 days | 24 hours |

`UNKNOWN` remains available for genuinely indeterminate temporal data, but an invalid or explicitly future macro observation date is rejected and never becomes canonical. FRED is marked `STALE` if every successfully normalized macro observation is stale. Cache entries use the existing `p365-dashboard` tag and can be invalidated by the existing dashboard refresh action.

## [IMPLEMENTED] events

FOMC meetings are ingested from the official Federal Reserve calendar as canonical Events with calendar Evidence. They are distinct from FRED observations. Because that calendar parser verifies a meeting date/window rather than a meeting time, `scheduledAt` uses a documented `00:00:00Z` date anchor (`scheduledAtIsDateAnchor: true`) and is not an actual meeting-time claim. FOMC statements are not fetched in v0.1, so no statement Evidence is fabricated.

The existing FMP economic calendar continues to provide its existing CPI, PCE, nonfarm payrolls, and GDP release-event coverage where configured. This implementation does not claim official agency calendars for those releases.

## [IMPLEMENTED] environment and failure semantics

| Variable | Purpose |
| --- | --- |
| `FRED_API_KEY` | Server-only FRED API key required for macro measurements. |

`FRED_API_KEY` must remain server-side and must not use a `NEXT_PUBLIC_` prefix. It is not exposed to React components.

Provider states are preserved: `SUCCESS`, `EMPTY`, `ERROR`, and `UNAVAILABLE` are distinct. An HTTP error, invalid credentials, timeout, or malformed FRED response is `ERROR`; a valid response without usable observations is `EMPTY`; no configured FRED key is `UNAVAILABLE`. Partial series availability is returned with valid observations plus a diagnostic message, rather than fabricated data.

## [NOT IMPLEMENTED]

- Release-date / revision-vintage subsystem.
- Official CPI, PCE, nonfarm payrolls, and GDP release calendar providers.
- FOMC statement ingestion.
- Context, State, Risk, Intelligence, Regime, LDS, Capital Flow, trading logic, forecasting, scoring, or recommendations.

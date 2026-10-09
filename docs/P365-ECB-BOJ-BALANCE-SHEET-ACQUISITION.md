# DATA-ECB-BOJ — FRED Balance Sheet Acquisition

**Scope:** P365 Macro → BTC + Gold factual context (internal/non-commercial).
**PR:** #270. **One function:** persist two previously missing central-bank balance-sheet series via the **existing** FRED pipeline and scheduler. This does not create a global-M2/global-liquidity aggregate, trading signal or UI score.

## Qualified source contracts

| FRED series | Provider/release | Native unit | Cadence | Canonical axes | Last-mile qualification |
| --- | --- | --- | --- | --- | --- |
| `ECBASSETSW` | European Central Bank / Weekly Financial Statements of the Eurosystem (FRED release 271) | Millions of Euros | WEEKLY; original observation date is a week, not publication time | POLICY / OBSERVATION / EURO_AREA / BALANCE_SHEET | Existing FRED native observation date, vintage date, retrievedAt, revision identity and Evidence |
| `JPNASSETS` | Bank of Japan / Bank of Japan Accounts (FRED release 266) | 100 Million Yen | MONTHLY, end of period | POLICY / OBSERVATION / JAPAN / BALANCE_SHEET | Same canonical provenance rules; release calendar is publisher reference only |

- Official series: https://fred.stlouisfed.org/series/ECBASSETSW and https://fred.stlouisfed.org/series/JPNASSETS.
- Source series are copyrighted (ECB and Bank of Japan); retain source credit. **No blanket authorization to redistribute provider history.**
- No implicit EUR/JPY → USD FX translation or summing of raw balance-sheet levels. The two series are **separate native-currency facts**.
- Per-observation `releasedAt` remains null when FRED does not provide it, preserving point-in-time knowledge bounds.

## Production implementation

1. Registry and source semantics are part of PR #270.
2. The existing FRED observation adapter, provenance, normalization and append-only Market Memory persistence are unchanged.
3. `JPNASSETS` is included in the old release-calendar branch through publisher release ID 266; the *active* `p365-fred-release-aware` cron uses `fredProviderUpdates=1`, selecting registered provider changes and daily full sweep.
4. The guarded idempotent database migration `scripts/ops/data_ecb_boj_fred_rpc_allowlist.sql` changes only the two IDs allowed by `p365_insert_fred_observations_v1(jsonb)`; the base RPC installer in `scripts/ops/obs_fred_001g_install_rpc.sql` is synchronized but should **not** be executed as a production reinstall.
5. **Operational note 2026-10-09:** migration already applied to Supabase production and read back: both IDs allowed; function still SECURITY INVOKER; FRED revision gate remains disabled. No cron changed.

## Activation and acceptance in this same checkpoint

- After owner merge and successful production deployment, the active `*/5` FRED update lane and daily full sweep can ingest both series. No new cron or credentials.
- For deliberate historical depth (instead of waiting for gradual forward fill), send an **authenticated** bounded request via the existing endpoint:
  `/api/cron/historical-ingestion?mode=BACKFILL&providers=fred&fredSeries=ECBASSETSW,JPNASSETS&from=2026-07-01&to=2026-10-09`.
  Dates inclusive = 101 days, inside the existing 120-day selected-series limit. This is an **operation after deployment**, not an unauthenticated public URL.
- Confirm response `status=SUCCESS`, per-provider physical insert metrics, and no `PERSISTENCE_ERROR`. Do **not** confuse submitted/accepted with actual inserts.
- After the actual ingestion, verify data with SQL:
  ```sql
  SELECT
    payload #>> '{metadata,seriesId}' AS series_id,
    count(*) AS observation_rows,
    count(DISTINCT payload #>> '{metadata,observationDate}') AS distinct_periods,
    max(payload #>> '{metadata,observationDate}') AS latest_period,
    min(payload #>> '{metadata,unit}') AS native_unit,
    min(payload #>> '{metadata,frequency}') AS cadence
  FROM public.market_memory
  WHERE record_type = 'OBSERVATION' AND payload ->> 'sourceId' = 'fred'
    AND payload #>> '{metadata,seriesId}' IN ('ECBASSETSW', 'JPNASSETS')
  GROUP BY 1 ORDER BY 1;
  ```
- Validate their linked canonical Evidence and the **next natural FRED provider update**; new observations/valid revisions should be idempotent, and an unchanged backfill should not insert duplicate measurements.
- Do not label either series PRODUCTION-ACTIVE or data-present until this SELECT confirms rows. The database allowlist being ready is **not** acquisition proof.

## Verification and scope exclusions

Tests: FRED selector, FRED coordinated RPC allowlist parity, canonical semantic dimensions, normalized observations; lint and Next.js build via the PR GitHub Actions workflow. The production Vercel build-limit status is a platform limit, **not** a verified compilation result.

Not in this checkpoint: automatic publication-time claims, aggregate monetary base, FX conversion, global-liquidity score, risk-on/off labels, predictive/trading logic, Gold/BTC causal inference, new recurring jobs.

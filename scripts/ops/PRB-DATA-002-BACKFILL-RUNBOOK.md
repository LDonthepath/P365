# PRB-DATA-002 (#364) — bounded CPI/PCE backfill operator checkpoint

**State: CODE-ONLY / NOT ACTIVATED.** This PR does not acquire FRED data or authorize production writes. Owner must merge this PR and separately authorize the exact production write after reviewing the capacity/rollback gate. Do not infer approval from a general request to work on #364.

## Frozen dataset and rationale

Research #363 (accepted 13 Oct 2026) fixes exactly `CPIAUCSL`, `CPILFESL`, `PCEPI`, `PCEPILFE` at **monthly, seasonally-adjusted INDEX levels**, from **2024-09-01 through 2026-08-01** inclusive (24 period keys per series, 96 total). The 12 target comparison months are September 2025–August 2026. SA YoY = 100 × (INDEX[t]/INDEX[t-12] − 1); it must not be labelled the publisher's NSA CPI rate. No code here computes YoY.

The existing authenticated `/api/cron/historical-ingestion` FRED-only `mode=BACKFILL` + `fredSeries` selector is reused. It caps selected-series intervals at 120 inclusive days and validates full pagination. `lib/application/prb-data-002-backfill-plan.ts` generates these six **dry-run** requests deterministically:

| Request | from | to | Series | Minimum FRED HTTP pages |
|---|---|---|---|---:|
| 1 | 2024-09-01 | 2024-12-01 | Exactly the four above | 4 |
| 2 | 2025-01-01 | 2025-04-01 | Same | 4 |
| 3 | 2025-05-01 | 2025-08-01 | Same | 4 |
| 4 | 2025-09-01 | 2025-12-01 | Same | 4 |
| 5 | 2026-01-01 | 2026-04-01 | Same | 4 |
| 6 | 2026-05-01 | 2026-08-01 | Same | 4 |

**Minimum requests:** 6 authenticated operator invocations / 24 FRED pages (4 series × 6 windows); pagination, failures or retries may increase that count. Expected distinct series-periods: at most 96, including already-present periods. Initial audit #363 had 34 present/62 missing, **not** 96 new rows; duplicate histories and two record families (OBSERVATION/EVIDENCE) mean physical insert and storage cannot be inferred from missing periods. No API calls are made by the manifest. Preserve ALL old revisions.

## Mandatory activation gate (STOP if any fails)

1. Confirm exact owner-merged PR SHA, recent production SHA and code path, and explicit owner authorization **specifically** to write #364's four series and six windows. Do not activate from a preview build.
2. Read #333/#348 and current production capacity. Verify project-specific allocated quota/plan if possible; public Free 500 MB is **not** a verified project entitlement. Read `scripts/ops/prb_data_002_readback_readonly.sql` before any call. Capture baseline database bytes, target-period counts, missing matrix, revision IDs, last capturedAt, and active cron count **privately**.
3. Assess actual available headroom and provider quota, write amplification, and current risk guardrail. If capacity/entitlement is unresolved or potentially unsafe, remain BLOCKED and request an explicit risk decision. No threshold override, retention deletion, database schema, provider, paid API or cron change.
4. Verify `CRON_SECRET`-authenticated invocation using the operator's secure credential channel. Do not print credentials, paste the token into issues/logs, or weaken authentication. **No invocation is performed by this runbook or PR.**

## Only after authorization: bounded manual execution

For each of the six windows **one at a time**, issue an authenticated **POST** to the existing production endpoint with these query parameters (never omit the subset):

```text
providers=fred
mode=BACKFILL
fredSeries=CPIAUCSL,CPILFESL,PCEPI,PCEPILFE
from=<window.from>
to=<window.to>
```

Only the token-owning operator can send the request. Wait for a qualified provider receipt before considering the next window; record UTC start/end, requested URL **without credentials**, HTTP status, FRED `acquired/normalized`, `writeMetrics` for Observation/Evidence, errors and actual DB size delta. An HTTP 200, a `persisted` legacy counter or `SUCCESS` alone is **not** physical insertion proof: verify physical keys and captured_at with SQL. On timeout or ambiguous commit, **do not blindly retry**; read back first. Stop upon incomplete pagination, ERROR/UNAVAILABLE/PERSISTENCE_ERROR, surprising expansion, quota warning, mismatched periods, or an unqualified physical receipt.

After all permitted windows, run the **same** read-only SQL, collect per-period identity/revision lineage and physical counts. Verify all 4 × 24 distinct period keys or record the exact blocked gaps. For one newly captured older window, replay that exact same request once to test idempotence: compare keys, count, and `writeMetrics.observations.inserted=0` and `evidence.inserted=0` (not merely `persisted`). The normal FRED cron can add unrelated rows; attribute deltas only to these target periods/identities.

For YoY, structural month pairs alone are **not** PIT proof. Verify at least one same-series August 2026/August 2025 pair with current as-of after both retrievedAt and database captured_at, including compatible unit, nonzero numeric predecessor, quality and native vintage. Replaying as-of before backfill must not see the backfill. FRED `realtime_start` is a **date-only vintage**, not a reliable publication instant. `releasedAt` stays null without separately qualified source evidence; do not backdate `retrievedAt` or `captured_at`. Do not claim retroactive 2025 knowledge or historical first-release estimates.

## Halt / rollback boundary

This is a **manual non-scheduled** checkpoint: halt by invoking no further windows. There is no new cron to disable. Revert the code PR if a code rollback is required; the existing scheduler remains unchanged. Durable canonical records are append-only: **never DELETE, UPDATE, truncate or backdate ingested records to simulate rollback**. A bad factual version requires a separately approved correction/invalidation/supersession path; preexisting values and evidence stay intact. If any write result is uncertain, retain issue status BLOCKED until readback disambiguates it.

## Exact closure evidence

Link owner production-write permission, main/deployment SHA, per-window receipts/FRED page and DB-byte deltas, before/after `scripts/ops/prb_data_002_readback_readonly.sql` outputs (without credentials), 4/4 × 24 period coverage or explicit provider BLOCKED case, no deleted revisions, PIT-before/after proof, physical-duplicate re-run and test/CI report. Only then can #364 be VERIFIED → CLOSED; one reviewed PR or CI green does not suffice. No UI, model, source rights extension or other macro data changes.

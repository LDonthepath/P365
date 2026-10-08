# FRS-003 — FRED provider-update scheduler

**Status:** provider-update runtime and guarded activation/rollback SQL prepared; production cron is unchanged. Related [#231](https://github.com/LDonthepath/P365/issues/231). This change is opt-in until the owner reviews/merges the code and separately approves the SQL.

## Runtime behavior

- Authenticated endpoint mode: `GET /api/cron/historical-ingestion?mode=FORWARD&providers=fred&fredProviderUpdates=1`. Existing `fredReleaseAware=1` callers and the CoinGecko Context lane remain backward-compatible.
- The planner reads FRED's `/fred/series/updates` feed, ordered by `last_updated`, and selects only registered P365 series FRED reports updated in the preceding 15 minutes. A five-minute polling cadence is the proposed activation, giving the feed multiple chances to report an update while bounding the delay from FRED's `last_updated` time to observation fetch to the next poll under healthy operation.
- `last_updated` is FRED's server-side update time. It indicates when FRED reports a series update; it does not guarantee the publisher's release timestamp or establish first availability. Publisher calendars and guessed source times do not drive selection.
- Bounded recovery: full 33-series sweeps at 04:30/04:35/04:40 UTC; a late 04:31 dispatch or up to two missed ticks remain covered. The three redundant runs cost up to 99 series requests daily, not just 33. A total 15-minute outage can still miss recovery. A healthy feed with no matching updates triggers no observation requests.
- Outage cooldown: full 33-series fallback on feed failure is permitted only at UTC minute 00, once hourly; other failed five-minute polls explicitly defer with `FEED_UNAVAILABLE_DEFERRED` and zero observation GETs. Continuous outage ceiling is 24×33 + 3×33 = 891 observation-series requests/day before retries (not 9,504), still subject to owner authorization. If the feed later recovers beyond the 15-minute overlap, delayed updates may remain invisible until daily recovery; no zero-loss guarantee is claimed.
- Metadata uses FRED `start_time`/`end_time` minute bounds, `filter_value=all` (the FRED macro filter is geographic, not P365 classification), at most 3 pages × 1.5s timeout, and a 5s overall metadata deadline before the 60s endpoint must complete actual ingestion. Counts, offsets, ordering and completeness must validate; otherwise cooldown applies. FRED documents time-filter syntax but not its timezone; the current `America/Chicago` interpretation is an explicit source-qualification assumption based on example `last_updated` offsets, and must be verified upstream before activation. A zero-hit scan alone is not proof of no source updates.
- Acquisition and persistence continue through the canonical ingestion path. The response includes the selected count and scan window. Durable write verification must use actual HTTP/provider JSON and physical Observation/Evidence receipts, not only `cron.job_run_details.status`.

## Guarded operational activation

[`frs003_enable_fred_provider_updates.sql`](../scripts/ops/frs003_enable_fred_provider_updates.sql) changes only existing job #24 (`p365-fred-release-aware`) to the proposed five-minute schedule and provider-update URL mode. Its transaction checks the exact current job IDs, hourly schedules, Vault-authenticated transport, production host, and absence of another active FRED lane. Existing job #4 remains the hourly CoinGecko Context lane. The script is **not authorized to run merely by merging code**.

[`frs003_restore_hourly_release_aware_fred.sql`](../scripts/ops/frs003_restore_hourly_release_aware_fred.sql) restores job #24 to its previous hourly release-aware mode and leaves job #4 untouched. Existing full combined-lane rollback remains available separately in [`frs003_rollback.sql`](../scripts/ops/frs003_rollback.sql).

## Review and acceptance

1. Review and merge the runtime code; verify production deployment is READY on the exact merged SHA.
2. Separately approve the five-minute polling, 15-minute overlap, three daily recovery sweeps, hourly-only outage fallback, 891/day theoretical outage request ceiling, and residual lag risk. Verify upstream time-filter timezone and 33-series eligibility. Without source qualification and owner approval keep production cron unchanged.
3. In a trusted Supabase operational session, execute the activation SQL only after read-only preflight confirms jobs #4 and #24 still match its guards. Do not print cron commands or Vault values.
4. Verify two active jobs with no overlap: #4 hourly Context, #24 every five minutes FRED provider updates. On natural runs inspect `net._http_response` HTTP status and JSON, selected series/request counts, and actual canonical Observation/Evidence inserts. Confirm 04:30–04:44 UTC recovery and at least one FRED-reported update end-to-end.
5. Compare observed FRED requests/day, data freshness, and storage separately against the pre-change baseline. Roll back if provider success, freshness, or persistence regresses. Do not close #231 until natural provider-update and recovery-sweep evidence is recorded.

**No production cron, schema, grants, credentials, ingestion, or canonical data are changed by this code/SQL preparation. No self-merge.**

# FRS-003 — FRED provider-update scheduler

**Status:** provider-update runtime and guarded activation/rollback SQL prepared; production cron is unchanged. Related [#231](https://github.com/LDonthepath/P365/issues/231). This change is opt-in until the owner reviews/merges the code and separately approves the SQL.

## Runtime behavior

- Authenticated endpoint mode: `GET /api/cron/historical-ingestion?mode=FORWARD&providers=fred&fredProviderUpdates=1`. Existing `fredReleaseAware=1` callers and the CoinGecko Context lane remain backward-compatible.
- The planner reads FRED's `/fred/series/updates` feed, ordered by `last_updated`, and selects only registered P365 series FRED reports updated in the preceding 15 minutes. A five-minute polling cadence is the proposed activation, giving the feed multiple chances to report an update while bounding the delay from FRED's `last_updated` time to observation fetch to the next poll under healthy operation.
- `last_updated` is FRED's server-side update time. It indicates when FRED reports a series update; it does not guarantee the publisher's release timestamp or establish first availability. Publisher calendars and guessed source times do not drive selection.
- One full 33-series recovery sweep runs at 04:30 UTC, matching one invocation of the proposed `*/5 * * * *` cadence. Feed errors, malformed/partial pages, missing credentials, out-of-order results, or an update scan exceeding its page bound fail open to all 33 registered series. No matching registered updates returns an empty FRED result without observation requests.
- Since fail-open runs the registry on each failed poll, a persistent update-feed failure could request up to 33 series every five minutes (9,504 observation GETs/day before retries). Owner review must accept this fallback load or leave the current cadence unchanged; this is a worst-case estimate, not measured traffic.
- Update metadata is paginated until the 15-minute boundary is covered. The planner validates ordering and page metadata, caps scans at 20,000 rows, and does not log or return the credential-bearing URL.
- Acquisition and persistence continue through the canonical ingestion path. The response includes the selected count and scan window. Durable write verification must use actual HTTP/provider JSON and physical Observation/Evidence receipts, not only `cron.job_run_details.status`.

## Guarded operational activation

[`frs003_enable_fred_provider_updates.sql`](../scripts/ops/frs003_enable_fred_provider_updates.sql) changes only existing job #24 (`p365-fred-release-aware`) to the proposed five-minute schedule and provider-update URL mode. Its transaction checks the exact current job IDs, hourly schedules, Vault-authenticated transport, production host, and absence of another active FRED lane. Existing job #4 remains the hourly CoinGecko Context lane. The script is **not authorized to run merely by merging code**.

[`frs003_restore_hourly_release_aware_fred.sql`](../scripts/ops/frs003_restore_hourly_release_aware_fred.sql) restores job #24 to its previous hourly release-aware mode and leaves job #4 untouched. Existing full combined-lane rollback remains available separately in [`frs003_rollback.sql`](../scripts/ops/frs003_rollback.sql).

## Review and acceptance

1. Review and merge the runtime code; verify production deployment is READY on the exact merged SHA.
2. Separately approve the proposed five-minute polling, 15-minute overlap, 04:30 UTC recovery sweep, fail-open behavior, and its worst-case request load. If not approved, leave the existing production schedules unchanged.
3. In a trusted Supabase operational session, execute the activation SQL only after read-only preflight confirms jobs #4 and #24 still match its guards. Do not print cron commands or Vault values.
4. Verify two active jobs with no overlap: #4 hourly Context, #24 every five minutes FRED provider updates. On natural runs inspect `net._http_response` HTTP status and JSON, selected series/request counts, and actual canonical Observation/Evidence inserts. Confirm the 04:30 UTC full sweep and at least one FRED-reported update end-to-end.
5. Compare observed FRED requests/day, data freshness, and storage separately against the pre-change baseline. Roll back if provider success, freshness, or persistence regresses. Do not close #231 until natural provider-update and recovery-sweep evidence is recorded.

**No production cron, schema, grants, credentials, ingestion, or canonical data are changed by this code/SQL preparation. No self-merge.**

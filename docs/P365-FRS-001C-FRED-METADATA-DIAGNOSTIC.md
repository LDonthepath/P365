# FRS-001C — Credential-safe FRED metadata diagnostic (read-only)

Status: **Implementation checkpoint / owner review required**. Related #229 and #228.

## Purpose and execution boundary

One authenticated GET request queries **one** canonical FRED series already present in
`MACRO_SERIES_REGISTRY`. The endpoint is **not** a scheduler and cannot trigger
Market Memory ingestion, persistence, migration, backfill, or revision correction.

- Route: `GET /api/internal/fred-metadata?seriesId=SOFR`
- Authentication: existing server-side `CRON_SECRET` via the same Bearer rule
  as the cron endpoints. Calls without a secret fail closed (401).
- FRED source credential: existing server-side `FRED_API_KEY`.
- Never put either token in URL parameters, logs, browser pages, GitHub, or issue comments.
- The caller must be an authorized operator using a **trusted credential-injection path**.
  Do **not** run this from public browser JavaScript.
- Exactly one registered `seriesId` per call; duplicates, extra query parameters,
  unknown IDs, and other methods are rejected. Avoid burst loops across all 33.
- Each FRED upstream request times out in 3.5 seconds, with `cache: no-store`.
  Four bounded API reads at most (three concurrent; release dates depend on a valid release ID).
- Latest **20** source release dates and latest **20** change-vintage dates,
  both requested in descending order. These are **not complete histories**
  and should never be labeled exhaustive. No guessed future release calendar.
- Responses are `private, no-store`, contain only allowlisted source metadata,
  and never include the key, full upstream URLs, source error messages or raw API bodies.
- All upstream failures are sanitized; `UNAVAILABLE` (HTTP 502) or
  `PARTIAL` reflects the state of the qualification, not a green pipeline result.

## Upstream endpoints and fields

| FRED endpoint | Qualified output | Source boundary |
|---|---|---|
| `fred/series` | `title, frequency, units, last_updated, observation_start, observation_end` | Official series metadata |
| `fred/series/release` | `release_id, release name` | Official linked release metadata |
| `fred/release/dates` | Latest 20 dates for **qualified release ID** | Publisher release calendar **when data available on source**; does not prove when FRED provides it |
| `fred/series/vintagedates` | Latest 20 series change-vintage dates | Change/new observation dates, not per-observation releasedAt or FRED first availability |

Official documentation:
https://fred.stlouisfed.org/docs/api/fred/series.html
https://fred.stlouisfed.org/docs/api/fred/series_release.html
https://fred.stlouisfed.org/docs/api/fred/release_dates.html
https://fred.stlouisfed.org/docs/api/fred/series_vintagedates.html

Every qualified field includes `provenance: METADATA_FRED`; unavailable or
malformed fields are `TIDAK TERVERIFIKASI` (never silently guessed).
`firstAvailableInFredAt` remains **null**, even if source dates are present.

**Critical:** FRED explicitly cautions `fred/release/dates` release dates are
provided by data publishers and *may differ from actual FRED availability*.
Timezone/DST and first-availability lag must be established independently
before a per-series scheduler contract is frozen.

## Diagnostic acceptance and next steps

1. Owner reviews/merges the PR; verify Vercel production deployment exact main SHA.
2. Owner authorizes a bounded **read-only metadata run**, one series per
   authenticated request. No cron scheduling/HTTP traffic from a public UI.
3. Record sanitized results 33/33 in #229 (exact numeric release ID, raw
   last_updated including timezone, release history/vintage count,
   source links, unknowns).
4. Cross-check mismatched registry units, especially `DTWEXBGS`, without
   changing canonical identity or old stored data in this checkpoint.
5. Source-vs-FRED first-availability and late revision sweeps remain separate
   empirical gates (observed first P365 `captured_at` is only a bound).
6. After owner reviews the 33/33 qualification, separately implement FRS-002
   selective ingestion. FRS-003 cron activation still requires explicit approval.
7. Do not confuse `ingestion.persisted` submitted rows with physical INSERTs;
   fix FRED observability in its own PR after this checkpoint.

**No new dependency, paid API, cron, database schema, canonical write,
asset-regime inference, or trade signal in FRS-001C.**

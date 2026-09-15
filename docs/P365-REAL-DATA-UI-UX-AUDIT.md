# P365 Real-Data and Semantic UI/UX Audit v0.1

## Scope

This audit covers the live ingestion boundary, canonical records returned by
`getDashboardData()`, and the dashboard language used to describe those records.
It does not introduce a market-regime, risk, or intelligence rule.

## Findings and remediation

1. **Calendar events referenced Evidence records that were not emitted.** An Event
   had an `evidenceId`, but the dashboard's canonical evidence collection did not
   include an Evidence object with that ID. Calendar normalization now emits both
   records together and `getDashboardData()` includes the Event evidence. Its
   capture time is the normalization time; the scheduled time stays in metadata.
2. **Provider payload defects could be presented as current data.** Missing or
   invalid timestamps in Alpha Vantage and CoinDesk responses previously fell back
   to the current time. Such records are now discarded instead of being relabelled
   as fresh.
3. **Market-observation freshness was inferred from parseability alone.** A valid
   but old quote is now `STALE`; only quotes observed within 15 minutes are
   `FRESH`. A future or invalid timestamp remains `UNKNOWN`.
4. **A slow provider could keep the server render waiting without a bounded
   request.** Each external request now has a 10-second abort signal. The existing
   per-provider error result continues to drive the data-health UI.
5. **Calendar day labels depended on the server's local timezone.** Today and
   tomorrow are now compared using Asia/Jakarta calendar dates, matching the WIB
   time displayed to the user.
6. **The state copy claimed verified observations even when none were returned.**
   The empty state now explicitly says that no verifiable observation was returned;
   it otherwise makes the narrower claim that observations are available but not
   interpreted.
7. **Calendar times lacked machine-readable semantics.** Each displayed time now
   has a `dateTime` value and a descriptive accessible label. The overview link is
   also marked as the current in-page location.

## Remaining limitations

- The dashboard deliberately does not derive a market state or intelligence from
  the fetched data. Evidence and observations are not trading signals.
- Freshness is measured from the provider's reported observation timestamp, not
  from a provider SLA. A source can be reachable while its latest quote is stale;
  the UI reports this through observation quality rather than claiming freshness.
- The economic calendar is now provided by Forex Factory's weekly feed. FOMC events
  remain sourced from the official Federal Reserve calendar, which is treated as
  authoritative for FOMC dates.
- The current canonical calendar contract does not yet model official release
  revisions or actual/forecast/previous values as structured fields.

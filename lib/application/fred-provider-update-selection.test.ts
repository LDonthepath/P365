import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { planFredProviderUpdatedObservations } from "./fred-provider-update-selection";
import { parseHistoricalIngestionRequest } from "./historical-ingestion-request";
import { createHistoricalIngestionHandler } from "./historical-ingestion-http";
import type { HistoricalIngestionOptions } from "./historical-ingestion";

const KEY = "test-only-fred-key";
const ALL = MACRO_SERIES_REGISTRY.map((series) => series.seriesId);
const activateSql = readFileSync(resolve("scripts/ops/frs003_enable_fred_provider_updates.sql"), "utf8");
const rollbackSql = readFileSync(resolve("scripts/ops/frs003_restore_hourly_release_aware_fred.sql"), "utf8");
const at = (value: string) => new Date(value);
function payload(seriess: Array<{ id: string; last_updated: string }>, overrides: Record<string, unknown> = {}) {
  return Response.json({ count: seriess.length, offset: 0, limit: 1000, seriess, ...overrides });
}
function parse(query: string) {
  return parseHistoricalIngestionRequest(new URLSearchParams(query));
}

test("only FRED-reported registered updates inside the overlap trigger observation acquisition", async () => {
  const plan = await planFredProviderUpdatedObservations({
    now: at("2026-10-08T12:31:00Z"), apiKey: KEY,
    fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/fred/series/updates");
      assert.equal(url.searchParams.get("filter_value"), "all");
      assert.equal(url.searchParams.has("start_time"), false);
      assert.equal(url.searchParams.has("end_time"), false);
      assert.equal(url.searchParams.get("order_by"), "last_updated");
      assert.equal(url.searchParams.get("sort_order"), "desc");
      assert.equal(url.searchParams.get("limit"), "1000");
      assert.equal(url.searchParams.get("offset"), "0");
      assert.equal(url.searchParams.get("api_key"), KEY);
      assert.equal(init?.cache, "no-store");
      return payload([
        { id: "CPIAUCSL", last_updated: "2026-10-08 07:29:00-05" },
        { id: "UNREGISTERED", last_updated: "2026-10-08 07:28:00-05" },
        { id: "SOFR", last_updated: "2026-10-08 07:16:00-05" },
        { id: "EFFR", last_updated: "2026-10-08 06:59:00-05" },
      ]);
    }) as typeof fetch,
  });
  assert.equal(plan.mode, "PROVIDER_UPDATE_RECHECK");
  assert.deepEqual(plan.seriesIds, ["SOFR", "CPIAUCSL"]);
  assert.equal(plan.requestedSeriesCount, 2);
  assert.equal(plan.scanWindowStartUTC, "2026-10-08T12:16:00.000Z");
});

test("no registered provider updates yields an empty acquisition plan", async () => {
  const plan = await planFredProviderUpdatedObservations({
    now: at("2026-10-08T12:31:00Z"), apiKey: KEY,
    fetcher: (async () => payload([
      { id: "UNREGISTERED", last_updated: "2026-10-08 07:14:00-05" },
    ])) as typeof fetch,
  });
  assert.equal(plan.mode, "NO_REGISTERED_UPDATES");
  assert.deepEqual(plan.seriesIds, []);
  assert.equal(plan.requestedSeriesCount, 0);
});

test("update feed pagination verifies the overlap boundary before returning a partial selection", async () => {
  const offsets: number[] = [];
  const firstPage = Array.from({ length: 1000 }, () => ({
    id: "UNREGISTERED", last_updated: "2026-10-08 07:30:00-05",
  }));
  const plan = await planFredProviderUpdatedObservations({
    now: at("2026-10-08T12:31:00Z"), apiKey: KEY,
    fetcher: (async (input: RequestInfo | URL) => {
      const offset = Number(new URL(String(input)).searchParams.get("offset"));
      offsets.push(offset);
      return offset === 0
        ? payload(firstPage, { count: 1002, offset: 0 })
        : payload([
          { id: "EFFR", last_updated: "2026-10-08 07:20:00-05" },
          { id: "UNREGISTERED", last_updated: "2026-10-08 07:15:00-05" },
        ], { count: 1002, offset: 1000 });
    }) as typeof fetch,
  });
  assert.deepEqual(offsets, [0, 1000]);
  assert.equal(plan.mode, "PROVIDER_UPDATE_RECHECK");
  assert.deepEqual(plan.seriesIds, ["EFFR"]);
});

test("outage, malformed, unsorted, incomplete, or unbounded update scans fail open", async () => {
  const now = at("2026-10-08T12:31:00Z");
  const variants = [
    () => new Response("down", { status: 503 }),
    () => payload([{ id: "SOFR", last_updated: "invalid" }]),
    () => payload([
      { id: "SOFR", last_updated: "2026-10-08 07:20:00-05" },
      { id: "EFFR", last_updated: "2026-10-08 07:30:00-05" },
    ]),
    () => payload([{ id: "SOFR", last_updated: "2026-10-08 07:20:00-05" }], { count: 2 }),
  ];
  for (const variant of variants) {
    const plan = await planFredProviderUpdatedObservations({
      now, apiKey: KEY, fetcher: (async () => variant()) as typeof fetch,
    });
    assert.equal(plan.mode, "FEED_UNAVAILABLE_DEFERRED");
    assert.deepEqual(plan.seriesIds, []);
  }
  const unbounded = await planFredProviderUpdatedObservations({
    now, apiKey: KEY,
    fetcher: (async () => payload(Array.from({ length: 1000 }, () => ({
      id: "UNREGISTERED", last_updated: "2026-10-08 07:30:00-05",
    })), { count: 21_000 })) as typeof fetch,
  });
  assert.equal(unbounded.mode, "FEED_UNAVAILABLE_DEFERRED");
  assert.deepEqual(unbounded.seriesIds, []);
});

test("recovery tolerates 04:31 delayed dispatch, missed ticks at 04:35/04:40, not perpetual repeats", async () => {
  let calls = 0;
  for (const minute of ["04:30", "04:31", "04:35", "04:40", "04:44"]) {
    const plan = await planFredProviderUpdatedObservations({
      now: at("2026-10-08T" + minute + ":00Z"), apiKey: KEY,
      fetcher: (async () => { calls++; throw new Error("daily sweep must not scan updates"); }) as typeof fetch,
    });
    assert.equal(plan.mode, "DAILY_FULL_SWEEP", minute);
    assert.deepEqual(plan.seriesIds, ALL);
  }
  assert.equal(calls, 0);
  const outside = await planFredProviderUpdatedObservations({
    now: at("2026-10-08T04:45:00Z"), apiKey: KEY,
    fetcher: (async () => payload([])) as typeof fetch,
  });
  assert.equal(outside.mode, "NO_REGISTERED_UPDATES");
});

test("spring DST transition uses explicit last_updated offset without undocumented time filters", async () => {
  const plan = await planFredProviderUpdatedObservations({
    now: at("2026-03-08T08:05:00Z"), apiKey: KEY,
    fetcher: (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.has("start_time"), false);
      assert.equal(url.searchParams.has("end_time"), false);
      return payload([
        { id: "EFFR", last_updated: "2026-03-08 01:59:00-06" },
        { id: "SOFR", last_updated: "2026-03-08 01:44:00-06" },
      ]);
    }) as typeof fetch,
  });
  assert.equal(plan.mode, "PROVIDER_UPDATE_RECHECK");
  assert.deepEqual(plan.seriesIds, ["EFFR"]);
});

test("fall DST repeated hour is ordered by explicit offsets, not local wall clock", async () => {
  const plan = await planFredProviderUpdatedObservations({
    now: at("2026-11-01T07:05:00Z"), apiKey: KEY,
    fetcher: (async () => payload([
      { id: "EFFR", last_updated: "2026-11-01 01:00:00-06" },
      { id: "SOFR", last_updated: "2026-11-01 01:55:00-05" },
      { id: "CCSA", last_updated: "2026-11-01 01:45:00-05" },
    ])) as typeof fetch,
  });
  assert.equal(plan.mode, "PROVIDER_UPDATE_RECHECK");
  // Selection is returned in stable P365 registry order, not feed order.
  assert.deepEqual(plan.seriesIds, ["EFFR", "SOFR"]);
});

test("metadata outage only falls back hourly, so 5-minute polling cannot amplify failure by 12x", async () => {
  let calls = 0;
  for (const hhmm of ["12:31", "12:35", "12:55", "13:00", "13:01"]) {
    const plan = await planFredProviderUpdatedObservations({
      now: at("2026-10-08T" + hhmm + ":00Z"), apiKey: KEY,
      fetcher: (async () => { calls++; throw new Error("offline"); }) as typeof fetch,
    });
    assert.equal(plan.mode, hhmm === "13:00" ? "FAIL_OPEN_FULL_SWEEP" : "FEED_UNAVAILABLE_DEFERRED");
    assert.equal(plan.requestedSeriesCount, hhmm === "13:00" ? 33 : 0);
  }
  assert.equal(calls, 5);
});

test("new URL mode is mutually exclusive and stays authenticated FRED FORWARD only", () => {
  assert.deepEqual(parse("mode=FORWARD&providers=fred&fredProviderUpdates=1"), {
    ok: true, options: { mode: "FORWARD", providers: ["fred"] }, fredProviderUpdates: true,
  });
  for (const query of [
    "providers=fred&fredProviderUpdates=0",
    "providers=fred&fredProviderUpdates=1&fredProviderUpdates=1",
    "mode=BACKFILL&providers=fred&fredProviderUpdates=1&from=2026-01-01&to=2026-01-02",
    "providers=fred,coingecko-context&fredProviderUpdates=1",
    "providers=fred&fredProviderUpdates=1&fredReleaseAware=1",
    "providers=fred&fredProviderUpdates=1&fredSeries=SOFR",
    "providers=cftc&fredProviderUpdates=1",
  ]) assert.equal(parse(query).ok, false, query);
});

test("authenticated handler passes the FRED-updated series to the ingestion runner", async () => {
  let runnerCalls = 0;
  let selected: HistoricalIngestionOptions | null = null;
  const handler = createHistoricalIngestionHandler(
    async (options) => { runnerCalls++; selected = options; return {
      mode: "FORWARD", status: "EMPTY", providers: [], persistedObservations: 0, persistedEvidence: 0,
    }; },
    () => "cron-secret",
    undefined,
    async () => ({
      seriesIds: ["SOFR"], mode: "PROVIDER_UPDATE_RECHECK",
      scanAsOfUTC: "2026-10-08T12:31:00.000Z",
      scanWindowStartUTC: "2026-10-08T12:16:00.000Z",
      requestedSeriesCount: 1, matchedRegisteredUpdates: 1,
    }),
  );
  const response = await handler(new Request(
    "https://p365.example/api/cron/historical-ingestion?providers=fred&fredProviderUpdates=1",
    { headers: { Authorization: "Bearer cron-secret" } },
  ));
  assert.equal(response.status, 200);
  assert.equal(runnerCalls, 1);
  assert.deepEqual((selected as HistoricalIngestionOptions | null)?.fred?.seriesIds, ["SOFR"]);
  assert.deepEqual((await response.json()).fredSchedule, {
    mode: "PROVIDER_UPDATE_RECHECK", scanAsOfUTC: "2026-10-08T12:31:00.000Z",
    scanWindowStartUTC: "2026-10-08T12:16:00.000Z",
    requestedSeriesCount: 1, matchedRegisteredUpdates: 1,
  });
});

test("activation SQL switches only FRED job 24 and has an inverse guarded rollback", () => {
  assert.match(activateSql, /jobid=24 AND jobname='p365-fred-release-aware'/);
  assert.match(activateSql, /schedule := '\*\/5 \* \* \* \*'/);
  assert.match(activateSql, /fredProviderUpdates=1/);
  assert.match(activateSql, /jobid=4 AND jobname='p365-fred'/);
  assert.match(activateSql, /providers=coingecko-context/);
  assert.match(activateSql, /RAISE EXCEPTION 'FRS-003 provider-update preflight failed/);
  assert.match(rollbackSql, /schedule := '31 \* \* \* \*'/);
  assert.match(rollbackSql, /fredProviderUpdates=1/);
  assert.match(rollbackSql, /fredReleaseAware=1/);
  assert.match(rollbackSql, /RAISE EXCEPTION 'FRS-003 restore preflight failed/);
});

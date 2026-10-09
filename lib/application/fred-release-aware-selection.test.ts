import assert from "node:assert/strict";
import test from "node:test";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { planFredReleaseAwareObservations } from "./fred-release-aware-selection";
import { parseHistoricalIngestionRequest } from "./historical-ingestion-request";
import { createHistoricalIngestionHandler } from "./historical-ingestion-http";
import type { HistoricalIngestionOptions } from "./historical-ingestion";

const FRED_KEY = "test-credential-not-a-real-key";
const at = (text: string) => new Date(text);
const ALL: string[] = MACRO_SERIES_REGISTRY.map((s) => s.seriesId);
const FREQUENT: string[] = MACRO_SERIES_REGISTRY.filter((s) =>
  s.frequency === "DAILY" || s.frequency === "WEEKLY").map((s) => s.seriesId);
const report = { mode: "FORWARD" as const, status: "SUCCESS" as const,
  providers: [], persistedObservations: 0, persistedEvidence: 0 };
function calendarResponse(
  releases: Array<{ release_id: number; date: string }>,
  overrides: Record<string, unknown> = {},
) {
  return Response.json({ count: releases.length, offset: 0, limit: 1000,
    release_dates: releases, ...overrides });
}
function parse(params: string) {
  return parseHistoricalIngestionRequest(new URLSearchParams(params));
}

test("35/35 registry coverage: 16 daily + 7 weekly preserved hourly, 12 slower qualified", () => {
  assert.equal(ALL.length, 35);
  assert.equal(FREQUENT.length, 23);
  assert.equal(new Set(ALL).size, 35);
});

test("release day: one metadata request selects all hourly frequent + matched monthly/quarterly", async () => {
  let calls = 0;
  const result = await planFredReleaseAwareObservations({
    now: at("2026-10-08T12:31:00Z"), apiKey: FRED_KEY,
    fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      const u = new URL(String(input));
      assert.equal(u.origin, "https://api.stlouisfed.org");
      assert.equal(u.pathname, "/fred/releases/dates");
      assert.equal(u.searchParams.get("realtime_start"), null,
        "FRED vintage bounds must not be confused with publisher release dates");
      assert.equal(u.searchParams.get("realtime_end"), null);
      assert.equal(u.searchParams.get("order_by"), "release_date");
      assert.equal(u.searchParams.get("sort_order"), "desc");
      assert.equal(u.searchParams.get("offset"), "0");
      assert.equal(u.searchParams.get("include_release_dates_with_no_data"), "true");
      assert.equal(u.searchParams.get("api_key"), FRED_KEY);
      assert.equal(init?.cache, "no-store");
      return calendarResponse([
        { date: "2026-10-08", release_id: 10 },
        { date: "2026-10-07", release_id: 53 },
      ]);
    }) as typeof fetch,
  });
  assert.equal(calls, 1);
  assert.equal(result.mode, "RELEASE_RECHECK");
  assert.equal(result.calendarDateNY, "2026-10-08");
  assert.equal(result.releaseWindowSeriesCount, 3);
  assert.equal(result.requestedSeriesCount, 26);
  assert.deepEqual(result.seriesIds.filter((s) => !FREQUENT.includes(s)),
    ["CPIAUCSL", "CPILFESL", "GDPC1"]);
  for (const id of FREQUENT) assert.ok(new Set<string>(result.seriesIds).has(id), id);
});

test("off-release window polls 23 critical frequent series; calendar metadata isn't publication time", async () => {
  const plan = await planFredReleaseAwareObservations({
    now: at("2026-10-08T19:31:00Z"), apiKey: FRED_KEY,
    fetcher: (async () => calendarResponse([
      { date: "2026-10-08", release_id: 320 },
      { date: "2026-10-07", release_id: 379 },
    ])) as typeof fetch,
  });
  assert.equal(plan.mode, "HOURLY_FREQUENT");
  assert.equal(plan.requestedSeriesCount, 23);
  assert.deepEqual(plan.seriesIds, FREQUENT);
  for (const id of ["SOFR", "EFFR", "IORB", "DGS2", "DFII10", "DTWEXBGS",
    "WALCL", "WRESBAL", "WTREGEN", "ICSA", "CCSA", "SP500"]) {
    assert.ok(new Set<string>(plan.seriesIds).has(id), "must protect " + id);
  }
});

test("4 UTC is a full 35-series daily sweep with zero metadata lookups", async () => {
  let calls = 0;
  const plan = await planFredReleaseAwareObservations({
    now: at("2026-10-08T04:31:00Z"), apiKey: FRED_KEY,
    fetcher: (async () => { calls++; throw new Error("never called"); }) as typeof fetch,
  });
  assert.equal(plan.mode, "DAILY_FULL_SWEEP");
  assert.deepEqual(plan.seriesIds, ALL);
  assert.equal(calls, 0);
});

test("calendar outages, malformed/partial results fail OPEN to full 35 not silently skip", async () => {
  const now = at("2026-10-08T12:31:00Z");
  const responses = [
    () => new Response("down", { status: 503 }),
    () => calendarResponse([{ date: "2026-10-08", release_id: 10 }], { count: 5000 }),
    () => calendarResponse([{ date: "2026-10-08", release_id: 10 }], { count: 2 }),
    () => calendarResponse([{ date: "2026-10-31", release_id: 10 }]),
    () => calendarResponse([{ date: "2026-10-08", release_id: "10" as unknown as number }]),
    () => new Response("{invalid", { status: 200 }),
  ];
  for (const response of responses) {
    const plan = await planFredReleaseAwareObservations({
      now, apiKey: FRED_KEY, fetcher: (async () => response()) as typeof fetch,
    });
    assert.equal(plan.mode, "FAIL_OPEN_FULL_SWEEP");
    assert.deepEqual(plan.seriesIds, ALL);
  }
  const noKey = await planFredReleaseAwareObservations({ now, apiKey: "",
    fetcher: (async () => { throw Error("fail"); }) as typeof fetch });
  // Explicit empty key may fallback to configured env: if no env provided,
  // fail-open is still the safe behavior and never returns fewer than 35.
  if (!process.env.FRED_API_KEY) assert.equal(noKey.mode, "FAIL_OPEN_FULL_SWEEP");
});

test("NY calendar date follows real DST boundaries, not a fixed UTC offset", async () => {
  const dates: string[] = [];
  for (const iso of ["2026-11-01T03:31:00Z", "2026-11-01T05:31:00Z",
    "2026-11-01T06:31:00Z"]) {
    const plan = await planFredReleaseAwareObservations({
      now: at(iso), apiKey: FRED_KEY,
      fetcher: (async (url: RequestInfo | URL) => {
        assert.equal(new URL(String(url)).searchParams.get("realtime_end"), null);
        return calendarResponse([{ date: "2026-10-30", release_id: 999 }]);
      }) as typeof fetch,
    });
    dates.push(plan.calendarDateNY);
    assert.equal(plan.requestedSeriesCount, 23);
  }
  assert.deepEqual(dates, ["2026-10-31", "2026-11-01", "2026-11-01"]);
});

test("URL opt-in is authenticated FRED FORWARD only and incompatible with manual selector", () => {
  assert.deepEqual(parse("mode=FORWARD&providers=fred&fredReleaseAware=1"), {
    ok: true, options: { mode: "FORWARD", providers: ["fred"] }, fredReleaseAware: true,
  });
  for (const url of [
    "mode=FORWARD&providers=fred&fredReleaseAware=0",
    "mode=FORWARD&providers=fred&fredReleaseAware=1&fredReleaseAware=1",
    "mode=BACKFILL&providers=fred&fredReleaseAware=1&from=2026-01-01&to=2026-01-02",
    "mode=FORWARD&providers=fred,coingecko-context&fredReleaseAware=1",
    "mode=FORWARD&providers=fred&fredReleaseAware=1&fredSeries=DGS2",
    "mode=FORWARD&providers=cftc&fredReleaseAware=1",
  ]) assert.equal(parse(url).ok, false, url);
  assert.deepEqual(parse("mode=FORWARD&providers=fred,coingecko-context"), {
    ok: true, options: { mode: "FORWARD", providers: ["fred", "coingecko-context"] },
  });
});

test("HTTP handler authenticates BEFORE planner and returns selected count with real runner", async () => {
  let plannerCalls = 0;
  let ingestions = 0;
  let selectedOptions: HistoricalIngestionOptions | null = null;
  const handler = createHistoricalIngestionHandler(
    async (options) => { ingestions++; selectedOptions = options; return report; },
    () => "correct-secret",
    async () => {
      plannerCalls++;
      return { mode: "RELEASE_RECHECK", calendarDateNY: "2026-10-08",
        seriesIds: ["DGS2", "CPIAUCSL"], requestedSeriesCount: 2,
        releaseWindowSeriesCount: 1 };
    },
  );
  const url = "https://p365.example/api/cron/historical-ingestion?mode=FORWARD&providers=fred&fredReleaseAware=1";
  const denied = await handler(new Request(url));
  assert.equal(denied.status, 401);
  assert.equal(plannerCalls, 0);
  assert.equal(ingestions, 0);
  const accepted = await handler(new Request(url, {
    headers: { Authorization: "Bearer correct-secret" },
  }));
  assert.equal(accepted.status, 200);
  assert.equal(plannerCalls, 1);
  assert.equal(ingestions, 1);
  assert.deepEqual((selectedOptions as HistoricalIngestionOptions | null)?.fred?.seriesIds,
    ["DGS2", "CPIAUCSL"]);
  assert.deepEqual((await accepted.json()).fredSchedule, {
    mode: "RELEASE_RECHECK", calendarDateNY: "2026-10-08",
    requestedSeriesCount: 2, releaseWindowSeriesCount: 1,
  });
  const legacy = await handler(new Request("https://p365.example/api/cron/historical-ingestion?providers=fred,coingecko-context",
    { headers: { Authorization: "Bearer correct-secret" } }));
  assert.equal(legacy.status, 200);
  assert.equal(plannerCalls, 1, "original cron path never calls release planner");
  assert.equal((await legacy.json()).fredSchedule, undefined);
});

test("no calendar secret or upstream error payload leaks into planner response", async () => {
  const handler = createHistoricalIngestionHandler(
    async () => report, () => "secret",
    async () => planFredReleaseAwareObservations({
      now: at("2026-10-08T12:31:00Z"), apiKey: FRED_KEY,
      fetcher: (async () => { throw new Error("request api_key=" + FRED_KEY); }) as typeof fetch,
    }),
  );
  const res = await handler(new Request(
    "https://p365.example/api/cron/historical-ingestion?providers=fred&fredReleaseAware=1",
    { headers: { Authorization: "Bearer secret" } },
  ));
  assert.equal(res.status, 200);
  const output = JSON.stringify(await res.json());
  assert.equal(output.includes(FRED_KEY), false);
  assert.equal(output.includes("request api_key"), false);
  assert.match(output, /FAIL_OPEN_FULL_SWEEP/);
});


test("FRED release dates pagination scans sorted calendar pages instead of misusing vintage dates", async () => {
  const offsets: number[] = [];
  const firstPage = Array.from({length:1000}, () => ({ date:"2026-10-12", release_id:999 }));
  const plan = await planFredReleaseAwareObservations({
    now: at("2026-10-08T12:31:00Z"), apiKey: FRED_KEY,
    fetcher: (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.has("realtime_start"), false);
      assert.equal(url.searchParams.has("realtime_end"), false);
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      return offset === 0
        ? calendarResponse(firstPage, {count:1002,offset:0})
        : calendarResponse([
            {date:"2026-10-08", release_id:10},
            {date:"2026-10-01", release_id:999},
          ], {count:1002,offset:1000});
    }) as typeof fetch,
  });
  assert.deepEqual(offsets,[0,1000]);
  assert.equal(plan.mode,"RELEASE_RECHECK");
  assert.equal(plan.requestedSeriesCount,25);
  assert.deepEqual(plan.seriesIds.filter((x)=>!FREQUENT.includes(x)),["CPIAUCSL","CPILFESL"]);
});

test("uncovered publisher window, pagination metadata mismatch, or unsorted dates fail OPEN", async () => {
  const firstPage = Array.from({length:1000}, () => ({date:"2026-10-12",release_id:999}));
  const variants = [
    calendarResponse(firstPage,{count:1002,offset:0}),
    calendarResponse([{date:"2026-10-08",release_id:10}],{offset:4}),
    calendarResponse([{date:"2026-10-05",release_id:999},{date:"2026-10-08",release_id:10}]),
  ];
  for (const variant of variants) {
    const plan = await planFredReleaseAwareObservations({
      now: at("2026-10-08T12:31:00Z"),apiKey:FRED_KEY,
      fetcher:(async()=>variant.clone()) as typeof fetch,
    });
    assert.equal(plan.mode,"FAIL_OPEN_FULL_SWEEP");
    assert.deepEqual(plan.seriesIds, ALL);
  }
});


test("changing total or reverse date ordering across pages fails closed to full 35", async () => {
  const future = Array.from({length:1000}, () => ({date:"2026-10-12",release_id:999}));
  const tests = [
    () => calendarResponse([{date:"2026-10-08",release_id:10}], {count:1001,offset:1000}),
    () => calendarResponse([
      {date:"2026-10-13",release_id:10},
      {date:"2026-10-01",release_id:999},
    ], {count:1002,offset:1000}),
  ];
  for (const next of tests) {
    let seen = 0;
    const plan = await planFredReleaseAwareObservations({
      now: at("2026-10-08T12:31:00Z"), apiKey:FRED_KEY,
      fetcher: (async () => {
        seen++;
        return seen === 1
          ? calendarResponse(future, {count:1002,offset:0})
          : next();
      }) as typeof fetch,
    });
    assert.equal(seen,2);
    assert.equal(plan.mode,"FAIL_OPEN_FULL_SWEEP");
    assert.deepEqual(plan.seriesIds,ALL);
  }
});

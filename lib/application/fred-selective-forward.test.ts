import assert from "node:assert/strict";
import test from "node:test";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import type { MacroSeriesId } from "../data/macro-registry";
import { parseHistoricalIngestionRequest } from "./historical-ingestion-request";
import { runHistoricalIngestion } from "./historical-ingestion";

function parse(raw: string) {
  return parseHistoricalIngestionRequest(new URLSearchParams(raw));
}

test("FORWARD FRED selector accepts registered daily/weekly/monthly/quarterly and mixed context", () => {
  const series: MacroSeriesId[] = ["DGS2", "WALCL", "CPIAUCSL", "GDPC1"];
  assert.deepEqual(series.map((id) => MACRO_SERIES_REGISTRY.find((s) => s.seriesId === id)?.frequency),
    ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"]);
  const requested = parse("mode=FORWARD&providers=fred,coingecko-context&fredSeries=" + series.join(","));
  assert.deepEqual(requested, { ok: true, options: {
    mode: "FORWARD", providers: ["fred", "coingecko-context"], fred: { seriesIds: series },
  } });
  assert.deepEqual(parse("mode=FORWARD&providers=fred"), {
    ok: true, options: { mode: "FORWARD", providers: ["fred"] },
  }, "existing full-registry behavior unchanged");
});

test("selector rejects empty, unknown, duplicate, malformed, oversized and repeated query parameter", () => {
  const invalid = [
    "fredSeries=", "fredSeries=UNKNOWN", "fredSeries=DGS2,", "fredSeries=,DGS2",
    "fredSeries=DGS2,DGS2", "fredSeries=dgs2", "fredSeries=DGS2%26providers%3Dcftc",
    "fredSeries=DGS2&fredSeries=WALCL",
    "fredSeries=" + Array.from({length:34},()=>"DGS2").join(","),
  ];
  for (const query of invalid) {
    const result = parse("mode=FORWARD&providers=fred&" + query);
    assert.equal(result.ok, false, query);
  }
  for (const query of [
    "mode=FORWARD&providers=coingecko-context&fredSeries=DGS2",
    "mode=FORWARD&providers=fred,gold&fredSeries=DGS2",
    "mode=FORWARD&providers=cftc&fredSeries=DGS2",
  ]) assert.equal(parse(query).ok, false, query);
  // Selective FRED BACKFILL is approved for a single FRED provider and a bounded range.
  const bounded = parse("mode=BACKFILL&providers=fred&fredSeries=ECBASSETSW,JPNASSETS&from=2026-07-01&to=2026-10-09");
  assert.equal(bounded.ok, true, "ECB/BoJ 101-day backfill must pass request parsing");
});

test("the provider sends requests only for opt-in selected series, preserving canonical temporal data", async () => {
  process.env.FRED_API_KEY = "unit-test-not-a-secret";
  const { fetchFredMacroObservations } = await import("../data/fred");
  const originalFetch = globalThis.fetch;
  const touched: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.hostname, "api.stlouisfed.org");
    assert.equal(parsed.pathname, "/fred/series/observations");
    const id = parsed.searchParams.get("series_id");
    assert.ok(id);
    touched.push(id);
    assert.equal(parsed.searchParams.get("limit"), "8");
    assert.equal(parsed.searchParams.get("sort_order"), "desc");
    return Response.json({ observations: [{
      date: "2026-10-01", value: "4.25", realtime_start: "2026-10-02",
    }] });
  }) as typeof fetch;
  try {
    const selection: MacroSeriesId[] = ["GDPC1", "DGS2", "CPIAUCSL", "WALCL"];
    const result = await fetchFredMacroObservations({ seriesIds: selection, acquisitionMode: "FRESH" });
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.data.length, 4);
    assert.deepEqual(touched, MACRO_SERIES_REGISTRY
      .filter((s) => selection.includes(s.seriesId)).map((s) => s.seriesId));
    assert.equal(touched.length, 4, "4 fetches instead of the default 33");
    for (const data of result.data) {
      assert.equal(data.observationDate, "2026-10-01");
      assert.equal(data.value, "4.25");
      assert.equal(data.releasedAt, null, "do not infer source release timestamp");
      assert.equal(data.vintageDate, "2026-10-02");
      assert.equal(data.provenance.nativeSeriesId, data.series.seriesId);
      assert.equal(data.provenance.observationDate, data.observationDate);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("direct provider refuses unqualified selector before issuing any FRED requests", async () => {
  process.env.FRED_API_KEY = "unit-test-not-a-secret";
  const { fetchFredMacroObservations } = await import("../data/fred");
  const original = globalThis.fetch;
  let calls=0;
  globalThis.fetch = (async () => { calls++; throw new Error("must not fetch"); }) as typeof fetch;
  try {
    for (const query of [
      { seriesIds: ["NOT_REGISTRY"] },
      { seriesIds: ["DGS2","DGS2"] },
      { seriesIds: ["DGS2"], requireCompleteRange: true, observationStart: "2026-10-01" },
    ]) {
      // Runtime defense also rejects untyped callers.
      const result = await fetchFredMacroObservations(query as never);
      assert.equal(result.status, "ERROR");
    }
    const noProviderUpdates = await fetchFredMacroObservations({ seriesIds: [] });
    assert.equal(noProviderUpdates.status, "EMPTY");
    assert.equal(calls,0);
  } finally {
    globalThis.fetch = original;
  }
});

test("application rejects FRED subset outside supported provider combinations", async () => {
  for (const options of [
    { mode:"FORWARD", providers:["coingecko-context"], fred:{ seriesIds:["DGS2"] } },
    { mode:"FORWARD", providers:["fred","gold"], fred:{ seriesIds:["DGS2"] } },
  ]) {
    await assert.rejects(runHistoricalIngestion(options as never),
      /FRED subset requires FORWARD with fred or single-provider FRED BACKFILL/);
  }
});

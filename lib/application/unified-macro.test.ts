import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import type { ObservationHistoryQuery } from "../repositories/types";
import { buildRatesInflationReadModel, buildUnifiedMacroPoint, readDxyMacroHistory } from "./rates-inflation";
import { buildMacroCryptoGoldFactualContext } from "./mvp-factual-context";

const cutoff = new Date("2026-10-10T01:35:00Z");
function row(key: string, value: string, at: string, overrides: Partial<Observation> = {}): Observation {
  const dxy = key === "dxy.index.usd";
  return { id: `${key}-${at}-${value}`, domain: dxy ? "ASSET" : "MACRO", subject: key,
    value, observedAt: at, retrievedAt: "2026-10-09T21:12:00Z", sourceId: dxy ? "yahoo-finance" : "fred",
    quality: "FRESH", evidenceId: "fixture", metadata: dxy
      ? { metricId: key, symbol: "DX-Y.NYB", unit: "Index", freshnessCalendar: "ICE_USDX", previousClose: 999 }
      : { seriesId: key, unit: "Percent", frequency: "DAILY", observationDate: at.slice(0, 10) }, ...overrides };
}
const dxyRows = [row("dxy.index.usd", "102.231", "2026-10-09T20:59:59Z"), row("dxy.index.usd", "102.230", "2026-10-09T20:56:58Z")];
const yieldRows = (key: string) => [row(key, "4.75", "2026-10-08"), row(key, "4.77", "2026-10-07")];

test("DXY index delta and yield bps use each series' own valid predecessor and distinct times", () => {
  const dxy = buildUnifiedMacroPoint("dxy.index.usd", dxyRows, cutoff);
  const two = buildUnifiedMacroPoint("DGS2", yieldRows("DGS2"), cutoff);
  const real = buildUnifiedMacroPoint("DFII10", [row("DFII10", "2.87", "2026-10-08"), row("DFII10", "2.92", "2026-10-07")], cutoff);
  assert.ok(Math.abs(dxy.change! - 0.001) < 1e-9);
  assert.ok(Math.abs(two.change! + 2) < 1e-9);
  assert.ok(Math.abs(real.change! + 5) < 1e-9);
  assert.equal(dxy.previous?.value, 102.230, "never use Yahoo previousClose metadata");
  assert.equal(two.previous?.observedAt, "2026-10-07");
  assert.notEqual(dxy.latest?.observedAt, two.latest?.observedAt);
  assert.equal(real.latest?.sourceId, "fred");
});

test("weekend keeps provider timestamps and session-aware recency, without a synthetic Saturday observation", () => {
  const point = buildUnifiedMacroPoint("dxy.index.usd", dxyRows, cutoff);
  assert.equal(point.latest?.observedAt, "2026-10-09T20:59:59Z");
  assert.equal(point.latest?.freshness, "FRESH");
  assert.equal(buildUnifiedMacroPoint("DGS2", yieldRows("DGS2"), cutoff).latest?.observedAt, "2026-10-08");
});

test("holiday gaps select the actual previous measurement; no zero or carry-forward is invented", () => {
  const point = buildUnifiedMacroPoint("DGS2", [row("DGS2", "4.75", "2026-10-13"), row("DGS2", "4.70", "2026-10-09")]
    .map((item) => ({ ...item, retrievedAt: "2026-10-14T20:30:00Z" })), new Date("2026-10-14T21:00:00Z"));
  assert.equal(point.previous?.observedAt, "2026-10-09");
  assert.ok(Math.abs(point.change! - 5) < 1e-9);
  assert.equal(point.latest?.observedAt, "2026-10-13");
});

test("stale latest remains factual with current recency separate from immutable acquisition quality", () => {
  const point = buildUnifiedMacroPoint("DGS2", yieldRows("DGS2"), new Date("2026-10-20T12:00:00Z"));
  assert.equal(point.latest?.quality, "FRESH");
  assert.equal(point.latest?.freshness, "STALE");
  assert.ok(Math.abs(point.change! + 2) < 1e-9);
  assert.equal(buildUnifiedMacroPoint("dxy.index.usd", dxyRows, new Date("2026-10-12T12:00:00Z")).latest?.freshness, "STALE");
});

test("missing and predecessor unavailable are explicit; stored STALE predecessor is still a historical fact", () => {
  assert.equal(buildUnifiedMacroPoint("DGS2", [], cutoff).latest, null);
  const single = buildUnifiedMacroPoint("DGS2", yieldRows("DGS2").slice(0, 1), cutoff);
  assert.equal(single.change, null);
  assert.equal(single.previous, null);
  assert.match(single.reason!, /sebelumnya belum tersedia/);
  const rows = yieldRows("DGS2"); rows[1].quality = "STALE";
  assert.equal(buildUnifiedMacroPoint("DGS2", rows, cutoff).previous?.value, 4.77);
});

test("qualification rejects incompatible units, partial/unknown, future knowledge and fetch-time FRED rows", () => {
  const good = yieldRows("DGS2");
  const invalid = [
    row("DGS2", "99", "2026-10-09", { sourceId: "other" }),
    row("DGS2", "99", "2026-10-09", { quality: "PARTIAL" }),
    row("DGS2", "99", "2026-10-09", { quality: "UNKNOWN" }),
    row("DGS2", "99", "2026-10-09", { retrievedAt: "2026-10-11T12:00:00Z" }),
    row("DGS2", "99", "2026-10-09T12:00:00Z"),
    row("DGS2", "99", "2026-10-09", { metadata: { seriesId: "DGS2", unit: "USD", frequency: "DAILY" } }),
    row("DGS2", ".", "2026-10-09"),
  ];
  for (const bad of invalid) assert.equal(buildUnifiedMacroPoint("DGS2", [bad, ...good], cutoff).latest?.value, 4.75);
  assert.equal(buildUnifiedMacroPoint("dxy.index.usd", [row("dxy.index.usd", "100", "2026-10-09T20:00:00Z", { metadata: { metricId: "dxy.index.usd", symbol: "DTWEXBGS", unit: "Index" } })], cutoff).latest, null);
});

test("same-time revisions cannot become predecessors; newest known revision wins before qualification", () => {
  const rows = yieldRows("DGS2");
  const correction = { ...rows[0], id: "correction", value: "4.76", retrievedAt: "2026-10-09T22:00:00Z" };
  const point = buildUnifiedMacroPoint("DGS2", [correction, ...rows], cutoff);
  assert.equal(point.latest?.value, 4.76);
  assert.equal(point.previous?.observedAt, "2026-10-07");
  assert.equal(buildUnifiedMacroPoint("DGS2", [{ ...correction, quality: "PARTIAL" }, ...rows], cutoff).latest?.value, 4.77,
    "do not resurrect an older revision of rejected measurement");
});

test("shared dashboard/MVP history performs one DXY latest read and one read per yield, with cutoff bounds", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([...dxyRows, ...yieldRows("DGS2"), ...yieldRows("DFII10")]);
  const queries: ObservationHistoryQuery[] = [];
  const repository = { async findHistory(query: ObservationHistoryQuery) { queries.push(query); return memory.findHistory(query); } };
  const dxyHistory = readDxyMacroHistory(repository, cutoff);
  const rates = buildRatesInflationReadModel(repository, cutoff, dxyHistory);
  const context = await buildMacroCryptoGoldFactualContext(repository, cutoff, { ratesInflation: rates, dxyHistory,
    netLiquidity: { status: "UNAVAILABLE", reason: "Fixture" } });
  assert.equal(context.macro.dxy.status, "AVAILABLE");
  const model = await rates;
  assert.equal(model.unifiedMacro?.filter((point) => point.latest).length, 3);
  for (const key of ["DGS2", "DFII10"]) assert.equal(queries.filter((query) => query.identity.seriesKey === key).length, 1);
  const latestDxyReads = queries.filter((query) => query.identity.seriesKey === "dxy.index.usd" && query.observedAtOnOrBefore === cutoff.toISOString());
  assert.equal(latestDxyReads.length, 1);
  assert.equal(latestDxyReads[0].limit, 100);
  assert.ok(queries.every((query) => query.retrievedAtOnOrBefore === cutoff.toISOString()));
});

test("DXY read error fails closed while qualified FRED yields remain visible", async () => {
  const repository = { async findHistory(query: ObservationHistoryQuery) {
    if (query.identity.seriesKey === "dxy.index.usd") throw new Error("fixture outage");
    return ["DGS2", "DFII10"].includes(query.identity.seriesKey) ? yieldRows(query.identity.seriesKey) : [];
  } };
  const result = await buildRatesInflationReadModel(repository, cutoff);
  assert.equal(result.unifiedMacro?.[0].latest, null);
  assert.equal(result.unifiedMacro?.filter((point) => point.latest).length, 2);
});

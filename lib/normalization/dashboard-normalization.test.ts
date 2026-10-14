import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  aggregateYahooHealth, yahooSeriesUnavailable, type YahooSeriesHealth,
} from "./yahoo-market-health";

const at = "2026-10-12T13:59:00.000Z";
function series(seriesKey: YahooSeriesHealth["seriesKey"], status: YahooSeriesHealth["status"]): YahooSeriesHealth {
  return { seriesKey, sourceId: "yahoo-finance", status, fetchedAt: at, itemCount: status === "HEALTHY" ? 1 : 0 };
}

test("MACRO-CUT-003F: retain the durable dashboard DTO, not the retired live normalization runtime", () => {
  const code = readFileSync(new URL("./dashboard-normalization.ts", import.meta.url), "utf8");
  assert.equal(existsSync(new URL("../ingestion/dashboard-ingestion.ts", import.meta.url)), false);
  assert.match(code, /export type NormalizedDashboardData = \{/);
  for (const field of ["macroNews", "cryptoNews", "calendarEvents", "observations", "macroObservations", "events",
    "economicEventResults", "contexts", "evidence", "providerHealth", "yahooSeriesHealth", "observationReadQuality"]) {
    assert.match(code, new RegExp("\\b" + field + "\\??: "));
  }
  assert.ok(code.split("\n").filter((line) => line.startsWith("import ")).every((line) => line.startsWith("import type ")));
  assert.doesNotMatch(code, /\bnormalizeDashboardData\b|from "\.\/provider-canonical"|from "\.\.\/ingestion\/dashboard-ingestion"/);
});

test("RECOVERY-G1-04: Gold ERROR cannot be hidden by healthy DXY in active Yahoo health helper", () => {
  const rows = [
    series("gold.futures.usd", "ERROR"),
    series("russell2000.index.usd", "EMPTY"),
    series("dxy.index.usd", "HEALTHY"),
  ];
  const rollup = aggregateYahooHealth(rows);
  const missing = yahooSeriesUnavailable(rows);
  assert.equal(rollup.status, "ERROR");
  assert.equal(rollup.sourceId, "yahoo-finance");
  assert.equal(rollup.itemCount, 1);
  assert.ok(missing.some((x) => x.includes("COMEX") && x.includes("gagal")));
  assert.ok(!missing.some((x) => x.includes("DXY (Yahoo")));
});

test("RECOVERY-G1-04: EMPTY and UNAVAILABLE Yahoo series remain distinct from HEALTHY", () => {
  const rows = [
    series("gold.futures.usd", "EMPTY"),
    series("russell2000.index.usd", "UNAVAILABLE"),
    series("dxy.index.usd", "HEALTHY"),
  ];
  assert.equal(aggregateYahooHealth(rows).status, "UNAVAILABLE");
  const missing = yahooSeriesUnavailable(rows);
  assert.ok(missing.some((x) => x.includes("COMEX") && x.includes("belum ada data")));
  assert.ok(missing.some((x) => x.includes("Russell 2000") && x.includes("tidak tersedia")));
  assert.ok(!missing.some((x) => x.includes("DXY (Yahoo")));
});

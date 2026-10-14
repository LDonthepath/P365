import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { EVENT_INGESTION_PROVIDERS } from "./event-ingestion";
import { HISTORICAL_INGESTION_PROVIDERS } from "./historical-ingestion-contract";

test("MACRO-CUT-003A: Bybit acquisition and sample adapter are physically absent", () => {
  for (const file of ["../data/bybit-spot-flow.ts", "../data/bybit-spot-flow.test.ts"]) {
    assert.equal(existsSync(new URL(file, import.meta.url)), false, file);
  }
  const spot = readFileSync(new URL("./btc-spot-flow.ts", import.meta.url), "utf8");
  assert.doesNotMatch(spot, /bybit|Bybit|BYBIT/);
  assert.match(spot, /export function buildBinanceBtcSpotFlowWindow/);
  const ids = readFileSync(new URL("../data/types.ts", import.meta.url), "utf8");
  assert.doesNotMatch(ids, /"bybit-spot"/);
});

test("MACRO-CUT-003A: Biquote, macro providers and FRED registry are retained", () => {
  assert.deepEqual(EVENT_INGESTION_PROVIDERS,
    ["forex-factory", "biquote", "federal-reserve"]);
  assert.equal(MACRO_SERIES_REGISTRY.length, 37);
  assert.ok(HISTORICAL_INGESTION_PROVIDERS.includes("fred"));
  assert.ok(HISTORICAL_INGESTION_PROVIDERS.includes("federal-reserve-sep"));
  assert.ok(HISTORICAL_INGESTION_PROVIDERS.includes("gdelt"));
  const ingestion = readFileSync(new URL("./event-ingestion.ts", import.meta.url), "utf8");
  assert.match(ingestion, /fetchBiquoteEconomicCalendar/);
  assert.match(ingestion, /repositories\.eventResults\.saveMany/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("MACRO-CUT-003E: retired dashboard acquisition exposes only the unchanged type contract", () => {
  const source = readFileSync(new URL("./dashboard-ingestion.ts", import.meta.url), "utf8");
  const declarations = source.split("\n").filter((line) => line.startsWith("import "));
  assert.ok(declarations.length > 0 && declarations.every((line) => line.startsWith("import type ")));
  assert.match(source, /export type DashboardIngestion = \{/);
  for (const field of [
    "macroNews", "alphaVantageCryptoNews", "coinDeskNews", "calendar",
    "biquoteCalendar", "cryptoMarket", "goldSpot", "russell2000",
    "dxy", "fred", "fomc",
  ]) {
    assert.match(source, new RegExp(`^  ${field}: ProviderResult<`, "m"));
  }
  assert.doesNotMatch(source, /server-only|\bingestDashboardData\b|\bresultOrEmpty\b|Promise\.allSettled|\bfetch[A-Z]\w*\b/);
});

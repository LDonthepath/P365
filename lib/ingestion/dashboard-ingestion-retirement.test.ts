import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("MACRO-CUT-003E/003F: legacy live dashboard acquisition is physically retired", () => {
  assert.equal(existsSync(new URL("./dashboard-ingestion.ts", import.meta.url)), false);
  const normalization = readFileSync(new URL("../normalization/dashboard-normalization.ts", import.meta.url), "utf8");
  assert.match(normalization, /export type NormalizedDashboardData = \{/);
  assert.doesNotMatch(normalization, /\bnormalizeDashboardData\b|from "\.\.\/ingestion\/dashboard-ingestion"/);
});

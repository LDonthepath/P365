import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createRetiredAssetSnapshotHandler } from "./macro-cut-retired-snapshot-http";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { EVENT_INGESTION_PROVIDERS } from "./event-ingestion";
import { RETAINED_MACRO_INGESTION_PROVIDERS } from "./historical-ingestion-macro-providers";

test("MACRO-CUT-FINAL: asset Snapshot endpoints reject writes while preserving cron auth", async () => {
  const handler = createRetiredAssetSnapshotHandler(() => "secret");
  const url = "https://example.test/api/cron/snapshot-capture";
  assert.equal((await handler(new Request(url))).status, 401);
  assert.equal((await handler(new Request(url, {headers: {authorization: "Bearer wrong"}}))).status, 401);
  const response = await handler(new Request(url, {headers: {authorization: "Bearer secret"}}));
  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), {
    status: "RETIRED",
    reason: "ASSET_DEPENDENT_SNAPSHOT_CAPTURE_RETIRED",
    writesPerformed: false,
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  for (const route of ["../../app/api/cron/snapshot-capture/route.ts", "../../app/api/cron/snapshot-repair/route.ts"]) {
    const code = readFileSync(new URL(route, import.meta.url), "utf8");
    assert.match(code, /createRetiredAssetSnapshotHandler/);
    assert.doesNotMatch(code, /runEventWindowSnapshot(Capture|Repair)|createEventWindowSnapshot(Capture|Repair)Handler/);
  }
});

test("MACRO-CUT-FINAL: Coinalyze runtime diagnostics and dead adapters absent", () => {
  for (const path of [
    "../../app/api/diagnostics/coinalyze/route.ts",
    "../../app/api/diagnostics/coinalyze-preview/route.ts",
    "../data/coinalyze-derivatives.ts",
    "../data/coinalyze-derivatives.test.ts",
    "./coinalyze-derivatives-aggregation.ts",
    "./coinalyze-live-qualification.ts",
    "./coinalyze-preview-qualification-http.ts",
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), false, path);
});

test("MACRO-CUT-FINAL: retained macro ingestion and Biquote, provider metadata intact", () => {
  assert.equal(MACRO_SERIES_REGISTRY.length, 37);
  assert.deepEqual(EVENT_INGESTION_PROVIDERS, ["forex-factory", "biquote", "federal-reserve"]);
  assert.deepEqual(RETAINED_MACRO_INGESTION_PROVIDERS, ["fred", "federal-reserve-sep", "gdelt"]);
  // Historical/legacy source IDs are not relabeled to fake a macro provenance.
  assert.match(readFileSync(new URL("../data/types.ts", import.meta.url), "utf8"), /"coinalyze"/);
});

test("MACRO-CUT-FINAL: old executable cleanup scripts removed; current proof is SELECT only", () => {
  for (const path of [
    "../../scripts/ops/macro_cut_004_cron_rollback_operator.sql",
    "../../scripts/ops/macro_cut_004_execution_blocked.sql",
    "../../scripts/ops/macro_cut_004_inventory_readonly.sql",
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), false, path);
  const sql = readFileSync(new URL("../../scripts/ops/macro_cut_final_verify_readonly.sql",import.meta.url),"utf8");
  assert.match(sql,/COALESCE\(source_id,\s*payload->>'sourceId'/);
  assert.match(sql,/PASS_NO_NONMACRO_HISTORY/);
  assert.match(sql,/PASS_SNAPSHOT_JOB_PAUSED/);
  assert.match(sql,/PASS_NO_INTERNAL_CLEANUP_ARCHIVES/);
  const withoutComments = sql.replace(/--[^\n]*/g,"");
  assert.doesNotMatch(withoutComments,/\b(?:DELETE|TRUNCATE|DROP|ALTER|INSERT|UPDATE|CREATE|GRANT|REVOKE)\s/i);
  assert.doesNotMatch(withoutComments,/cron\.(?:unschedule|schedule|alter_job)\s*\(/);
});

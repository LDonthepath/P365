import assert from "node:assert/strict";
import test from "node:test";
import { createCoinalyzeLiveQualificationHandler } from "./coinalyze-live-qualification-http";
import type { CoinalyzeLiveQualificationReport } from "./coinalyze-live-qualification";

const baseReport: CoinalyzeLiveQualificationReport = {
  status: "READY_FOR_SEMANTIC_REVIEW",
  evaluatedAt: "2026-10-04T00:00:00.000Z",
  source: "coinalyze",
  writesPerformed: false,
  universe: null,
  provider: {
    futureMarkets: "SUCCESS",
    openInterest: null,
    funding: null,
    liquidation: null,
    ohlcv: null,
  },
  timestamps: [],
  sampleAggregates: null,
  unresolved: [
    "PROVIDER_TIMESTAMP_BUCKET_ANCHOR",
    "LIQUIDATION_L_S_CANONICAL_MAPPING",
    "DURABLE_PRIVATE_STORAGE_USE",
  ],
};

test("Coinalyze qualification diagnostics requires existing CRON_SECRET bearer auth", async () => {
  const handler = createCoinalyzeLiveQualificationHandler(async () => baseReport, () => "secret");
  const unauthorized = await handler(new Request("https://example.test/api/diagnostics/coinalyze"));
  assert.equal(unauthorized.status, 401);

  const authorized = await handler(new Request("https://example.test/api/diagnostics/coinalyze", {
    headers: { authorization: "Bearer secret" },
  }));
  assert.equal(authorized.status, 200);
});

test("Coinalyze qualification maps blocked and provider-failed reports to non-200 responses", async () => {
  const blocked = createCoinalyzeLiveQualificationHandler(
    async () => ({ ...baseReport, status: "BLOCKED_NO_API_KEY" }),
    () => "secret",
  );
  assert.equal((await blocked(new Request("https://example.test", {
    headers: { authorization: "Bearer secret" },
  }))).status, 503);

  const failed = createCoinalyzeLiveQualificationHandler(
    async () => ({ ...baseReport, status: "FAILED" }),
    () => "secret",
  );
  assert.equal((await failed(new Request("https://example.test", {
    headers: { authorization: "Bearer secret" },
  }))).status, 502);
});

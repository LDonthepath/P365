import assert from "node:assert/strict";
import test from "node:test";
import {
  createCoinalyzePreviewQualificationHandler,
} from "./coinalyze-preview-qualification-http";
import type { CoinalyzeLiveQualificationReport } from "./coinalyze-live-qualification";

const report: CoinalyzeLiveQualificationReport = {
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

test("preview qualification route is unavailable outside Vercel preview", async () => {
  const handler = createCoinalyzePreviewQualificationHandler(async () => report, () => "production");
  const response = await handler();
  assert.equal(response.status, 404);
});

test("preview qualification route returns live report only in Vercel preview", async () => {
  const handler = createCoinalyzePreviewQualificationHandler(async () => report, () => "preview");
  const response = await handler();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("preview qualification route preserves blocked/no-key and provider-failure status codes", async () => {
  const blocked = createCoinalyzePreviewQualificationHandler(
    async () => ({ ...report, status: "BLOCKED_NO_API_KEY" }),
    () => "preview",
  );
  assert.equal((await blocked()).status, 503);

  const failed = createCoinalyzePreviewQualificationHandler(
    async () => ({ ...report, status: "FAILED" }),
    () => "preview",
  );
  assert.equal((await failed()).status, 502);
});

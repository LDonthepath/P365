import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { providerResult } from "../data/types";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import {
  HISTORICAL_INGESTION_PROVIDERS,
  runHistoricalIngestion,
  type HistoricalIngestionAcquisition,
  type HistoricalIngestionProvider,
} from "./historical-ingestion";

// No canonical writes should be attempted for these zero-payload status fixtures.
const noWrites = {} as CanonicalRepositories;
function acquisitions(statuses: Partial<Record<HistoricalIngestionProvider, "SUCCESS" | "EMPTY" | "ERROR">>): HistoricalIngestionAcquisition {
  return Object.fromEntries(HISTORICAL_INGESTION_PROVIDERS.map((provider) => [
    provider,
    async () => providerResult(
      provider === "fred" ? "fred" : provider === "gold" || provider === "dxy" || provider === "russell"
        ? "yahoo-finance" : provider === "defillama" ? "defillama" : "coingecko",
      statuses[provider] ?? "EMPTY",
      [],
      statuses[provider] === "ERROR" ? "upstream failure" : undefined,
    ),
  ])) as unknown as HistoricalIngestionAcquisition;
}

test("RECOVERY-G3-02: exact FORWARD report parity for failed, missing and successful empty sources", async () => {
  const report = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["gold", "dxy", "fred", "gold"] },
    { acquisition: acquisitions({ gold: "ERROR", dxy: "SUCCESS", fred: "EMPTY" }), repositories: noWrites },
  );
  assert.deepEqual(report, {
    mode: "FORWARD",
    status: "PARTIAL",
    providers: [
      { provider: "gold", status: "ERROR", acquired: 0, normalized: 0,
        persisted: 0, persistedEvidence: 0, error: "upstream failure" },
      { provider: "dxy", status: "SUCCESS", acquired: 0, normalized: 0,
        persisted: 0, persistedEvidence: 0, error: undefined },
      { provider: "fred", status: "EMPTY", acquired: 0, normalized: 0,
        persisted: 0, persistedEvidence: 0,
        writeMetrics: {
          source: "NOT_EVALUATED",
          observations: { submitted: 0, inserted: 0, duplicates: 0 },
          evidence: { submitted: 0, inserted: 0, duplicates: 0 },
          revised: 0, revisionAssessment: "NOT_EVALUATED",
        },
        error: undefined,
      },
    ],
    persistedObservations: 0,
    persistedEvidence: 0,
  });
});

test("RECOVERY-G3-02: exact BACKFILL empty report and all-failure classification retained", async () => {
  const backfill = await runHistoricalIngestion(
    { mode: "BACKFILL", providers: ["defillama"], defillama: { from: "2026-10-01", to: "2026-10-02" } },
    { acquisition: acquisitions({ defillama: "EMPTY" }), repositories: noWrites },
  );
  assert.deepEqual(backfill, {
    mode: "BACKFILL", status: "EMPTY",
    providers: [{
      provider: "defillama", status: "EMPTY", acquired: 0, normalized: 0,
      persisted: 0, persistedEvidence: 0, error: undefined,
    }],
    persistedObservations: 0, persistedEvidence: 0,
  });
  const failed = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["gold", "russell"] },
    { acquisition: acquisitions({ gold: "ERROR", russell: "ERROR" }), repositories: noWrites },
  );
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.providers.length, 2);
  assert.deepEqual(failed.providers.map((row) => row.error), ["upstream failure", "upstream failure"]);
});

test("RECOVERY-G3-02: dispatcher contains no provider-native, normalization or persistence implementation", () => {
  const code = readFileSync(new URL("./historical-ingestion.ts", import.meta.url), "utf8");
  assert.doesNotMatch(code, /from ["']\.\.\/data\//);
  assert.doesNotMatch(code, /from ["']\.\.\/normalization\//);
  assert.doesNotMatch(code, /\.saveMany\(|\.saveManyWithReceipt\(/);
  assert.doesNotMatch(code, /fetch[A-Z]/);
  assert.match(code, /runHistoricalIngestion\(/);
});

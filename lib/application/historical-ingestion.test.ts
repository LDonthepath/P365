import assert from "node:assert/strict";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { MacroObservationInput } from "../data/fred";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { providerFetchPolicy } from "../data/provider-fetch-policy";
import { providerResult, type ProviderResult } from "../data/types";
import { InMemoryEvidenceRepository, InMemoryObservationRepository } from "../repositories/memory";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import {
  runHistoricalIngestion,
  type HistoricalIngestionAcquisition,
  type HistoricalIngestionProvider,
} from "./historical-ingestion";
import { parseHistoricalIngestionRequest } from "./historical-ingestion-request";

function observationInput(metricId: string): CryptoMarketObservationInput {
  return {
    metricId,
    symbol: "BTC",
    value: 100,
    observedAt: "2026-09-20T09:00:00.000Z",
    retrievedAt: "2026-09-20T09:00:01.000Z",
    source: "CoinGecko",
    freshnessCalendar: "CONTINUOUS_24_7",
    provenance: {
      version: "v1",
      providerResource: "/simple/price",
      nativeInstrumentId: "bitcoin",
    },
    metadata: { unit: "USD", providerAssetId: "bitcoin", endpoint: "/simple/price" },
  };
}

function marketResult(
  provider: "coingecko" | "yahoo-finance",
  data: CryptoMarketObservationInput[],
  status: ProviderResult<CryptoMarketObservationInput>["status"] = "SUCCESS",
): ProviderResult<CryptoMarketObservationInput> {
  return providerResult(provider, status, data, status === "ERROR" ? "provider failed" : undefined);
}

function macroInput(): MacroObservationInput {
  return {
    series: MACRO_SERIES_REGISTRY[0],
    value: "0.25",
    observationDate: "2020-01-01",
    previousValue: null,
    vintageDate: "2020-01-01",
    releasedAt: null,
    retrievedAt: "2026-09-20T09:00:01.000Z",
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations",
      nativeSeriesId: MACRO_SERIES_REGISTRY[0].seriesId,
      observationDate: "2020-01-01",
      vintageDate: "2020-01-01",
    },
  };
}

function repositories(): { repositories: CanonicalRepositories; observations: InMemoryObservationRepository } {
  const observations = new InMemoryObservationRepository();
  return {
    observations,
    repositories: {
      observations,
      evidence: new InMemoryEvidenceRepository(),
      events: { save: async () => undefined, saveMany: async () => undefined, findById: async () => null },
      contexts: { save: async () => undefined, saveMany: async () => undefined, findById: async () => null },
    },
  };
}

function acquisition(calls: HistoricalIngestionProvider[]): HistoricalIngestionAcquisition {
  const record = <T>(provider: HistoricalIngestionProvider, result: ProviderResult<T>) => async () => {
    calls.push(provider);
    return result;
  };
  return {
    coingecko: record("coingecko", marketResult("coingecko", [observationInput("btc.spot.usd")])),
    gold: record("gold", marketResult("yahoo-finance", [])),
    dxy: record("dxy", marketResult("yahoo-finance", [])),
    russell: record("russell", marketResult("yahoo-finance", [])),
    fred: record("fred", providerResult("fred", "EMPTY", [])),
  };
}

async function main(): Promise<void> {
  const selectedCalls: HistoricalIngestionProvider[] = [];
  const selectedStore = repositories();
  const selectedReport = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko"] },
    { acquisition: acquisition(selectedCalls), repositories: selectedStore.repositories },
  );
  assert.deepEqual(selectedCalls, ["coingecko"], "unselected providers must not be acquired");
  assert.equal(selectedReport.status, "SUCCESS");
  assert.equal(selectedReport.providers[0].normalized, 1);
  assert.equal(selectedReport.persistedObservations, 1);

  await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko"] },
    { acquisition: acquisition([]), repositories: selectedStore.repositories },
  );
  const history = await selectedStore.observations.findHistory({
    identity: { domain: "ASSET", seriesKey: "btc.spot.usd" },
    order: "ASC",
    limit: 10,
  });
  assert.equal(history.length, 1, "repeated ingestion must retain canonical idempotency");

  const backfillStore = repositories();
  const backfillAcquisition = acquisition([]);
  backfillAcquisition.fred = async () => providerResult("fred", "SUCCESS", [macroInput()]);
  const backfillOptions = {
    mode: "BACKFILL" as const,
    providers: ["fred" as const],
    fred: { observationStart: "2020-01-01", observationEnd: "2020-01-31", limit: 100 },
  };
  await runHistoricalIngestion(backfillOptions, {
    acquisition: backfillAcquisition,
    repositories: backfillStore.repositories,
  });
  await runHistoricalIngestion(backfillOptions, {
    acquisition: backfillAcquisition,
    repositories: backfillStore.repositories,
  });
  const backfillHistory = await backfillStore.observations.findHistory({
    identity: { domain: "MACRO", seriesKey: MACRO_SERIES_REGISTRY[0].seriesId },
    order: "ASC",
    limit: 10,
  });
  assert.equal(backfillHistory.length, 1, "repeated backfill must retain canonical idempotency");

  const incompleteBackfillStore = repositories();
  const incompleteBackfillAcquisition = acquisition([]);
  incompleteBackfillAcquisition.fred = async () => providerResult(
    "fred",
    "ERROR",
    [macroInput()],
    "one requested series could not prove completeness",
  );
  const incompleteBackfill = await runHistoricalIngestion(backfillOptions, {
    acquisition: incompleteBackfillAcquisition,
    repositories: incompleteBackfillStore.repositories,
  });
  assert.equal(incompleteBackfill.status, "PARTIAL");
  assert.equal(incompleteBackfill.persistedObservations, 1);
  assert.equal(incompleteBackfill.providers[0].status, "ERROR");
  assert.match(incompleteBackfill.providers[0].error ?? "", /could not prove completeness/);

  const partialStore = repositories();
  const partialAcquisition = acquisition([]);
  partialAcquisition.gold = async () => marketResult("yahoo-finance", [], "ERROR");
  const partial = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko", "gold"] },
    { acquisition: partialAcquisition, repositories: partialStore.repositories },
  );
  assert.equal(partial.status, "PARTIAL", "one provider failure must not suppress another provider write");
  assert.equal(partial.persistedObservations, 1);
  assert.equal(partial.providers.find((item) => item.provider === "gold")?.error, "provider failed");

  const failingStore = repositories();
  failingStore.repositories.observations.saveMany = async () => { throw new Error("storage unavailable"); };
  const failed = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko"] },
    { acquisition: acquisition([]), repositories: failingStore.repositories },
  );
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.providers[0].status, "PERSISTENCE_ERROR");
  assert.equal(failed.providers[0].error, "storage unavailable");

  assert.deepEqual(providerFetchPolicy("FRESH", 300), { cache: "no-store" });
  assert.deepEqual(providerFetchPolicy("CACHED", 300), {
    next: { revalidate: 300, tags: ["p365-fast"] },
  });

  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=FORWARD&providers=coingecko,gold,dxy")),
    { ok: true, options: { mode: "FORWARD", providers: ["coingecko", "gold", "dxy"] } },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=FORWARD&providers=coingecko,unknown")),
    { ok: false, error: "Unsupported providers: unknown" },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=gold&from=2026-09-01&to=2026-09-20")),
    { ok: false, error: "BACKFILL is currently supported only for fred" },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=fred&from=2026-09-01&to=2026-09-20")),
    {
      ok: true,
      options: {
        mode: "BACKFILL",
        providers: ["fred"],
        fred: { observationStart: "2026-09-01", observationEnd: "2026-09-20", limit: 100 },
      },
    },
  );
}

void main();

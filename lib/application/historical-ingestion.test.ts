import type { ProviderResult } from "../data/types";
import { providerResult } from "../data/types";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import { runHistoricalIngestion, type HistoricalIngestionAcquisition } from "./historical-ingestion";
import { InMemoryEvidenceRepository, InMemoryObservationRepository } from "../repositories/memory";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type { Observation } from "../domain/types";

function cryptoResult(data: CryptoMarketObservationInput[], status: ProviderResult<CryptoMarketObservationInput>["status"] = "SUCCESS"): ProviderResult<CryptoMarketObservationInput> {
  return providerResult("coingecko", status, data, status === "ERROR" ? "provider failed" : undefined, undefined, "2026-09-18T10:00:00.000Z");
}

function observationInput(metricId: string, observedAt = "2026-09-18T09:00:00.000Z"): CryptoMarketObservationInput {
  return { metricId, symbol: "BTC", value: 100, observedAt, retrievedAt: "2026-09-18T10:00:00.000Z", source: "CoinGecko", metadata: { unit: "USD" } };
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

function acquisition(overrides: Partial<HistoricalIngestionAcquisition> = {}): HistoricalIngestionAcquisition {
  const empty = async () => providerResult("yahoo-finance", "EMPTY", []);
  return {
    coingecko: async () => cryptoResult([observationInput("btc.spot.usd")]),
    fred: async () => providerResult("fred", "EMPTY", []),
    gold: empty,
    russell: empty,
    dxy: empty,
    ...overrides,
  };
}

async function main(): Promise<void> {
  const first = repositories();
  const report = await runHistoricalIngestion({ mode: "FORWARD" }, { acquisition: acquisition(), repositories: first.repositories });
  if (report.status !== "SUCCESS" || report.persistedObservations !== 1) throw new Error("independent ingestion did not persist canonical observation");
  const history = await first.observations.findHistory({ identity: { domain: "ASSET", seriesKey: "btc.spot.usd" }, order: "ASC", limit: 10 });
  if (history.length !== 1 || history[0].observedAt !== "2026-09-18T09:00:00.000Z") throw new Error("canonical normalization was not reused");

  const repeated = await runHistoricalIngestion({ mode: "FORWARD" }, { acquisition: acquisition(), repositories: first.repositories });
  if (repeated.persistedObservations !== 1) throw new Error("repeated invocation was not deterministic");
  const partial = repositories();
  const partialReport = await runHistoricalIngestion({ mode: "FORWARD" }, { acquisition: acquisition({ fred: async () => providerResult("fred", "ERROR", [], "FRED down") }), repositories: partial.repositories });
  if (partialReport.status !== "PARTIAL" || partialReport.persistedObservations !== 1) throw new Error("partial provider failure suppressed successful persistence");

  const failing = repositories();
  failing.repositories.observations.saveMany = async () => { throw new Error("storage unavailable"); };
  const failed = await runHistoricalIngestion({ mode: "FORWARD" }, { acquisition: acquisition(), repositories: failing.repositories });
  if (failed.status !== "FAILED" || !failed.providers.some((item) => item.status === "PERSISTENCE_ERROR")) throw new Error("persistence failure was hidden");
  const temporal: Observation = history[0];
  if (temporal.retrievedAt !== "2026-09-18T10:00:00.000Z") throw new Error("retrievedAt was fabricated");
}

void main();

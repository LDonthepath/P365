import type { ProviderId, ProviderResult } from "../data/types";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type { HistoricalIngestionAcquisition, HistoricalIngestionOptions, HistoricalIngestionProvider } from "./historical-ingestion-contract";
import { createRetainedMacroAcquisition } from "./historical-ingestion-macro-providers";

export async function defaultDependencies(options: HistoricalIngestionOptions): Promise<{
  acquisition: HistoricalIngestionAcquisition;
  repositories: CanonicalRepositories;
}> {
  // Legacy 13-provider acquisition is physically removed. Preserve its
  // in-process contract shape only for tests and historical DTO compatibility.
  // The public HTTP endpoint and non-injected runner both reject retired lanes.
  const [macro, repositories] = await Promise.all([
    createRetainedMacroAcquisition(options),
    import("../repositories/dashboard-repository"),
  ]);
  const retired = async (): Promise<never> => {
    throw new Error("Nonmacro historical acquisition has been retired");
  };
  return {
    acquisition: {
      "binance-spot": retired,
      "binance-book": retired,
      "hyperliquid-book": retired,
      coingecko: retired,
      "coingecko-context": retired,
      fred: macro.fred,
      "federal-reserve-sep": macro["federal-reserve-sep"],
      gold: retired,
      russell: retired,
      dxy: retired,
      usdjpy: retired,
      usdcnh: retired,
      defillama: retired,
      sosovalue: retired,
      cftc: retired,
      gdelt: macro.gdelt,
    },
    repositories: repositories.canonicalRepositories,
  };
}

function providerId(provider: HistoricalIngestionProvider): ProviderId {
  if (provider === "coingecko" || provider === "coingecko-context") return "coingecko";
  if (provider === "fred") return "fred";
  if (provider === "federal-reserve-sep") return "federal-reserve";
  if (provider === "defillama") return "defillama";
  if (provider === "sosovalue") return "sosovalue";
  if (provider === "cftc") return "cftc";
  if (provider === "gdelt") return "gdelt";
  if (provider === "binance-spot" || provider === "binance-book") return "binance-spot";
  if (provider === "hyperliquid-book") return "hyperliquid";
  return "yahoo-finance";
}

export async function acquireHistoricalResult(
  provider: HistoricalIngestionProvider,
  acquisition: HistoricalIngestionAcquisition,
): Promise<ProviderResult<unknown>> {
  try {
    return await acquisition[provider]();
  } catch (error) {
    return {
      providerId: providerId(provider),
      status: "ERROR",
      data: [],
      retrievedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Provider acquisition failed",
    };
  }
}

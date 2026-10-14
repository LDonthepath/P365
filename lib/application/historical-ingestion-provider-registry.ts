import type { ProviderId, ProviderResult } from "../data/types";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type { HistoricalIngestionAcquisition, HistoricalIngestionOptions, HistoricalIngestionProvider } from "./historical-ingestion-contract";
import { createRetainedMacroAcquisition } from "./historical-ingestion-macro-providers";
import { createNonMacroAcquisition } from "./historical-ingestion-nonmacro-providers";

export async function defaultDependencies(options: HistoricalIngestionOptions): Promise<{
  acquisition: HistoricalIngestionAcquisition;
  repositories: CanonicalRepositories;
}> {
  const [nonMacro, macro, repositories] = await Promise.all([
    createNonMacroAcquisition(options),
    createRetainedMacroAcquisition(options),
    import("../repositories/dashboard-repository"),
  ]);
  return {
    // Preserve existing provider keys, their ordering and their acquisition
    // contracts while allowing a later checkpoint to remove non-MVP lanes.
    acquisition: {
      "binance-spot": nonMacro["binance-spot"],
      "binance-book": nonMacro["binance-book"],
      "hyperliquid-book": nonMacro["hyperliquid-book"],
      coingecko: nonMacro.coingecko,
      "coingecko-context": nonMacro["coingecko-context"],
      fred: macro.fred,
      "federal-reserve-sep": macro["federal-reserve-sep"],
      gold: nonMacro.gold,
      russell: nonMacro.russell,
      dxy: nonMacro.dxy,
      usdjpy: nonMacro.usdjpy,
      usdcnh: nonMacro.usdcnh,
      defillama: nonMacro.defillama,
      sosovalue: nonMacro.sosovalue,
      cftc: nonMacro.cftc,
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

import type { ProviderId, ProviderResult } from "../data/types";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type { HistoricalIngestionAcquisition, HistoricalIngestionOptions, HistoricalIngestionProvider } from "./historical-ingestion-contract";
import { createRetainedMacroAcquisition, RETAINED_MACRO_INGESTION_PROVIDERS } from "./historical-ingestion-macro-providers";

export async function defaultDependencies(options: HistoricalIngestionOptions): Promise<{
  acquisition: HistoricalIngestionAcquisition;
  repositories: CanonicalRepositories;
}> {
  const retained = new Set<string>(RETAINED_MACRO_INGESTION_PROVIDERS);
  const needsNonMacro = options.providers.some((provider) => !retained.has(provider));
  const [nonMacro, macro, repositories] = await Promise.all([
    // Import the legacy market providers only when actually requested. A
    // FRED/SEP/GDELT cron run never initializes the 13 market acquisition modules.
    needsNonMacro
      ? import("./historical-ingestion-nonmacro-providers")
        .then(({ createNonMacroAcquisition }) => createNonMacroAcquisition(options))
      : Promise.resolve(null),
    createRetainedMacroAcquisition(options),
    import("../repositories/dashboard-repository"),
  ]);
  const unrequestedNonMacro = async (): Promise<never> => {
    throw new Error("An unrequested nonmacro provider cannot be acquired from a macro-only run");
  };
  return {
    // Preserve existing provider keys, their ordering and their acquisition
    // contracts while allowing a later checkpoint to remove non-MVP lanes.
    acquisition: {
      "binance-spot": nonMacro?.["binance-spot"] ?? unrequestedNonMacro,
      "binance-book": nonMacro?.["binance-book"] ?? unrequestedNonMacro,
      "hyperliquid-book": nonMacro?.["hyperliquid-book"] ?? unrequestedNonMacro,
      coingecko: nonMacro?.coingecko ?? unrequestedNonMacro,
      "coingecko-context": nonMacro?.["coingecko-context"] ?? unrequestedNonMacro,
      fred: macro.fred,
      "federal-reserve-sep": macro["federal-reserve-sep"],
      gold: nonMacro?.gold ?? unrequestedNonMacro,
      russell: nonMacro?.russell ?? unrequestedNonMacro,
      dxy: nonMacro?.dxy ?? unrequestedNonMacro,
      usdjpy: nonMacro?.usdjpy ?? unrequestedNonMacro,
      usdcnh: nonMacro?.usdcnh ?? unrequestedNonMacro,
      defillama: nonMacro?.defillama ?? unrequestedNonMacro,
      sosovalue: nonMacro?.sosovalue ?? unrequestedNonMacro,
      cftc: nonMacro?.cftc ?? unrequestedNonMacro,
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

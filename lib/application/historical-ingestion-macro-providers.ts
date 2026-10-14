import type { HistoricalIngestionAcquisition, HistoricalIngestionOptions, HistoricalIngestionProvider } from "./historical-ingestion-contract";

/**
 * Macro MVP preservation boundary. GDELT keeps its existing BTC/Gold feed
 * semantics until a separate, owner-approved macro-feed qualification.
 */
export const RETAINED_MACRO_INGESTION_PROVIDERS = [
  "fred", "federal-reserve-sep", "gdelt",
] as const satisfies readonly HistoricalIngestionProvider[];

type RetainedProvider = (typeof RETAINED_MACRO_INGESTION_PROVIDERS)[number];

export async function createRetainedMacroAcquisition(
  options: HistoricalIngestionOptions,
): Promise<Pick<HistoricalIngestionAcquisition, RetainedProvider>> {
  const [fred, federalReserveSep, gdelt] = await Promise.all([
    import("../data/fred"),
    import("../data/federal-reserve-sep"),
    import("../data/gdelt-gal"),
  ]);

  return {
    fred: () => fred.fetchFredMacroObservations({
      ...options.fred,
      acquisitionMode: "FRESH",
      requireCompleteRange: options.mode === "BACKFILL",
    }),
    "federal-reserve-sep": () => federalReserveSep.fetchFederalReserveSepObservations("FRESH"),
    gdelt: () => gdelt.fetchGdeltGalCandidateSnapshots({
      assets: ["BTC", "GOLD"],
      acquisitionMode: "FRESH",
    }),
  };
}

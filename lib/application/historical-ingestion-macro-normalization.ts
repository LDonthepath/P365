import type { MacroObservationInput } from "../data/fred";
import type { FederalReserveSepObservationInput } from "../data/federal-reserve-sep";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import type { ProviderResult } from "../data/types";
import type { Evidence, Observation } from "../domain/types";
import {
  macroToCanonicalRecords,
  federalReserveSepToCanonicalRecords,
  P365_SOURCES,
} from "../normalization/provider-canonical-macro";
import { gdeltGalSnapshotsToEvidence } from "./gdelt-gal-history";
import type { HistoricalIngestionProvider } from "./historical-ingestion-contract";
import { RETAINED_MACRO_INGESTION_PROVIDERS } from "./historical-ingestion-macro-providers";

export type CanonicalHistoricalBatch = { observations: Observation[]; evidence: Evidence[] };
export type RetainedMacroHistoricalProvider = typeof RETAINED_MACRO_INGESTION_PROVIDERS[number];

export function isRetainedMacroHistoricalProvider(
  provider: HistoricalIngestionProvider,
): provider is RetainedMacroHistoricalProvider {
  return (RETAINED_MACRO_INGESTION_PROVIDERS as readonly string[]).includes(provider);
}

/**
 * Only qualified FRED, Federal Reserve SEP and existing GDELT acquisition
 * results enter this canonicalization lane. GDELT retains its original BTC/GOLD
 * snapshot semantics and IDs; it is not relabelled as macro news.
 */
export function canonicalizeRetainedMacroResult(
  result: ProviderResult<unknown>,
  provider: RetainedMacroHistoricalProvider,
): CanonicalHistoricalBatch {
  if (provider === "fred") {
    return macroToCanonicalRecords(result.data as MacroObservationInput[], P365_SOURCES.fred.id);
  }
  if (provider === "federal-reserve-sep") {
    return federalReserveSepToCanonicalRecords(result.data as FederalReserveSepObservationInput[]);
  }
  return {
    observations: [],
    evidence: gdeltGalSnapshotsToEvidence({
      snapshots: result.data as GdeltGalFeedSnapshot[],
      retrievedAt: result.retrievedAt,
    }),
  };
}

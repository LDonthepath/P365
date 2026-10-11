import { soSoValueBackfillRangeError } from "../data/sosovalue-etf-flow";
import { cftcGoldCotBackfillRangeError } from "../data/cftc-gold-cot";
import { defiLlamaBackfillRangeError, fredSelectiveBackfillRangeError, type HistoricalIngestionOptions } from "./historical-ingestion-contract";

export function validateOptions(options: HistoricalIngestionOptions): void {
  if (options.providers.length === 0) throw new Error("At least one ingestion provider is required");
  if (options.fred?.seriesIds !== undefined) {
    const allowedForward = options.mode === "FORWARD" && options.providers.includes("fred")
      && options.providers.every((p) => p === "fred" || p === "coingecko-context");
    const allowedBackfill = options.mode === "BACKFILL"
      && options.providers.length === 1 && options.providers[0] === "fred";
    if (!allowedForward && !allowedBackfill) {
      throw new Error("FRED subset requires FORWARD with fred or single-provider FRED BACKFILL");
    }
    if (allowedBackfill) {
      const error = fredSelectiveBackfillRangeError({
        from: options.fred.observationStart ?? "",
        to: options.fred.observationEnd ?? "",
      });
      if (error) throw new Error(error);
    }
  }
  if (options.mode === "BACKFILL") {
    if (options.providers.length !== 1 || !["fred", "defillama", "sosovalue", "cftc"].includes(options.providers[0])) {
      throw new Error("BACKFILL requires exactly one supported provider: fred, defillama, sosovalue, or cftc");
    }
    if (options.providers[0] === "fred" && !options.fred) {
      throw new Error("FRED BACKFILL requires explicit options");
    }
    if (options.providers[0] === "defillama" && !options.defillama) {
      throw new Error("DefiLlama BACKFILL requires explicit options");
    }
    if (options.providers[0] === "sosovalue" && !options.sosovalue) {
      throw new Error("SoSoValue BACKFILL requires explicit options");
    }
    if (options.providers[0] === "cftc" && !options.cftc) {
      throw new Error("CFTC Gold COT BACKFILL requires explicit options");
    }
    if (options.providers[0] === "defillama" && options.defillama) {
      const rangeError = defiLlamaBackfillRangeError(options.defillama);
      if (rangeError) throw new Error(rangeError);
    }
    if (options.providers[0] === "sosovalue" && options.sosovalue) {
      const rangeError = soSoValueBackfillRangeError(options.sosovalue);
      if (rangeError) throw new Error(rangeError);
    }
    if (options.providers[0] === "cftc" && options.cftc) {
      const rangeError = cftcGoldCotBackfillRangeError(options.cftc);
      if (rangeError) throw new Error(rangeError);
    }
  }
}

import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { DefiLlamaStablecoinBackfillRange, DefiLlamaStablecoinObservationInput } from "../data/defillama-stablecoins";
import type { FredObservationQuery, MacroObservationInput } from "../data/fred";
import type { FederalReserveSepObservationInput } from "../data/federal-reserve-sep";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import type { BinanceSpotKline } from "../data/binance-spot-flow";
import type { BinanceOrderBookSnapshot } from "../data/binance-order-book";
import type { HyperliquidPerpOrderBookSnapshot } from "../data/hyperliquid-perp-order-book";
import type { SoSoValueBtcEtfFlowBackfillRange, SoSoValueBtcEtfFlowObservationInput } from "../data/sosovalue-etf-flow";
import type { CftcGoldCotBackfillRange, CftcGoldCotObservationInput } from "../data/cftc-gold-cot";
import type { ProviderResult } from "../data/types";

type MarketResult = ProviderResult<CryptoMarketObservationInput>;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFILLAMA_MAX_BACKFILL_CALENDAR_DAYS = 35;
export const FRED_SELECTIVE_BACKFILL_MAX_CALENDAR_DAYS = 120;

/** Restrict manual selected-series history acquisition without changing legacy full-registry backfills. */
export function fredSelectiveBackfillRangeError(range: { from: string; to: string }): string | null {
  const from = Date.parse(`${range.from}T00:00:00.000Z`);
  const to = Date.parse(`${range.to}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.from)
    || !/^\d{4}-\d{2}-\d{2}$/.test(range.to)
    || !Number.isFinite(from) || !Number.isFinite(to)
    || new Date(from).toISOString().slice(0, 10) !== range.from
    || new Date(to).toISOString().slice(0, 10) !== range.to || from > to) {
    return "FRED selective BACKFILL requires valid from/to date bounds";
  }
  return (to - from) / DAY_MS + 1 > FRED_SELECTIVE_BACKFILL_MAX_CALENDAR_DAYS
    ? `FRED selective BACKFILL is limited to ${FRED_SELECTIVE_BACKFILL_MAX_CALENDAR_DAYS} calendar days`
    : null;
}

export const HISTORICAL_INGESTION_PROVIDERS = ["coingecko", "coingecko-context", "gold", "dxy", "russell", "usdjpy", "usdcnh", "fred", "federal-reserve-sep", "defillama", "sosovalue", "cftc", "gdelt", "binance-spot", "binance-book", "hyperliquid-book"] as const;
export type HistoricalIngestionProvider = typeof HISTORICAL_INGESTION_PROVIDERS[number];
export type HistoricalIngestionMode = "FORWARD" | "BACKFILL";

export type HistoricalIngestionOptions = {
  mode: HistoricalIngestionMode;
  providers: HistoricalIngestionProvider[];
  fred?: Omit<FredObservationQuery, "acquisitionMode" | "requireCompleteRange">;
  defillama?: DefiLlamaStablecoinBackfillRange;
  sosovalue?: SoSoValueBtcEtfFlowBackfillRange;
  cftc?: CftcGoldCotBackfillRange;
  /** Opt-in CFTC FORWARD-only publisher-calendar gate; default cron unchanged. */
  cftcReleaseAware?: boolean;
};

export type HistoricalIngestionAcquisition = {
  coingecko: () => Promise<MarketResult>;
  "coingecko-context": () => Promise<MarketResult>;
  fred: () => Promise<ProviderResult<MacroObservationInput>>;
  "federal-reserve-sep": () => Promise<ProviderResult<FederalReserveSepObservationInput>>;
  gold: () => Promise<MarketResult>;
  russell: () => Promise<MarketResult>;
  dxy: () => Promise<MarketResult>;
  usdjpy: () => Promise<MarketResult>;
  usdcnh: () => Promise<MarketResult>;
  defillama: () => Promise<ProviderResult<DefiLlamaStablecoinObservationInput>>;
  sosovalue: () => Promise<ProviderResult<SoSoValueBtcEtfFlowObservationInput>>;
  cftc: () => Promise<ProviderResult<CftcGoldCotObservationInput>>;
  gdelt: () => Promise<ProviderResult<GdeltGalFeedSnapshot>>;
  "binance-spot": () => Promise<ProviderResult<BinanceSpotKline>>;
  "binance-book": () => Promise<ProviderResult<BinanceOrderBookSnapshot>>;
  "hyperliquid-book": () => Promise<ProviderResult<HyperliquidPerpOrderBookSnapshot>>;
};

/** FRED write receipt: exact PostgREST insert count, not legacy accepted count. */
export type FredPhysicalWriteMetrics = {
  source: "POSTGREST_RETURNING_KEYS" | "FRED_COORDINATED_RPC" | "NOT_EVALUATED";
  observations: { submitted: number; inserted: number | null; duplicates: number | null };
  evidence: { submitted: number; inserted: number | null; duplicates: number | null };
  /** A new physical insert is not necessarily a revision of an existing measurement. */
  revised: number | null;
  revisionAssessment: "COMPLETE" | "NOT_EVALUATED";
};

export type HistoricalIngestionProviderReport = {
  provider: HistoricalIngestionProvider;
  status: ProviderResult<unknown>["status"] | "PERSISTENCE_ERROR";
  acquired: number;
  normalized: number;
  persisted: number;
  persistedEvidence: number;
  /** Optional FRED-only actual write receipt. Legacy persisted counts mean accepted, NOT inserts. */
  writeMetrics?: FredPhysicalWriteMetrics;
  error?: string;
};

export type HistoricalIngestionReport = {
  mode: HistoricalIngestionMode;
  status: "SUCCESS" | "PARTIAL" | "EMPTY" | "FAILED";
  providers: HistoricalIngestionProviderReport[];
  persistedObservations: number;
  persistedEvidence: number;
};

export function defiLlamaBackfillRangeError(range: DefiLlamaStablecoinBackfillRange): string | null {
  const from = Date.parse(`${range.from}T00:00:00.000Z`);
  const to = Date.parse(`${range.to}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(range.from)
    || !/^\d{4}-\d{2}-\d{2}$/.test(range.to)
    || !Number.isFinite(from)
    || !Number.isFinite(to)
    || new Date(from).toISOString().slice(0, 10) !== range.from
    || new Date(to).toISOString().slice(0, 10) !== range.to
    || from > to
  ) {
    return "DefiLlama BACKFILL requires valid from/to date bounds";
  }
  const inclusiveCalendarDays = (to - from) / DAY_MS + 1;
  return inclusiveCalendarDays > DEFILLAMA_MAX_BACKFILL_CALENDAR_DAYS
    ? `DefiLlama BACKFILL is limited to ${DEFILLAMA_MAX_BACKFILL_CALENDAR_DAYS} calendar days`
    : null;
}

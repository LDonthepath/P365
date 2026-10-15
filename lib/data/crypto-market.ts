import type { ObservationProvenance } from "../domain/types";
import type { MarketFreshnessCalendar } from "../domain/freshness";

/** Historic market provider DTO retained for injected canonical and durable-history compatibility. */
export type CryptoMarketObservationInput = { metricId: string; symbol: string; value: number; observedAt: string; retrievedAt: string; source: string; provenance: ObservationProvenance; freshnessCalendar: MarketFreshnessCalendar; metadata: Record<string, string | number | boolean | null> };

import { BTC_ETF_NET_FLOW_SERIES_KEY } from "../domain/observation-semantics";
import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

export const BTC_ETF_FLOW_HISTORY_QUERY_LIMIT = 50;
export const BTC_ETF_FLOW_RECENT_SESSION_LIMIT = 5;

export type BtcEtfFlowPoint = {
  value: number;
  observedAt: string;
  providerTradingDate: string;
  retrievedAt: string;
  quality: DataQuality;
  observationId: string;
};

export type BtcEtfFlowReadModel = {
  asOf: string;
  seriesKey: typeof BTC_ETF_NET_FLOW_SERIES_KEY;
  latest: BtcEtfFlowPoint | null;
  previous: BtcEtfFlowPoint | null;
  recent: BtcEtfFlowPoint[];
};

function pointFromObservation(observation: Observation): BtcEtfFlowPoint | null {
  if (!observation.value.trim()) return null;
  const value = Number(observation.value);
  if (!Number.isFinite(value)) return null;
  const metadataDate = observation.metadata?.providerTradingDate;
  const providerTradingDate = typeof metadataDate === "string"
    ? metadataDate
    : observation.observedAt.slice(0, 10);
  return {
    value,
    observedAt: observation.observedAt,
    providerTradingDate,
    retrievedAt: observation.retrievedAt,
    quality: observation.quality,
    observationId: observation.id,
  };
}

/**
 * Reads one bounded point-in-time history page and collapses factual revisions
 * so a trading date can occupy at most one session in the returned view.
 */
export async function buildBtcEtfFlowReadModel(
  repository: HistoricalObservationRepository,
  asOf = new Date(),
): Promise<BtcEtfFlowReadModel> {
  if (!Number.isFinite(asOf.getTime())) throw new Error("BTC ETF flow read model requires a valid asOf cutoff.");
  const cutoff = asOf.toISOString();
  const history = await repository.findHistory({
    identity: { domain: "MARKET", seriesKey: BTC_ETF_NET_FLOW_SERIES_KEY },
    sourceId: "sosovalue-etf-flow",
    observedAtOnOrBefore: cutoff,
    retrievedAtOnOrBefore: cutoff,
    order: "DESC",
    limit: BTC_ETF_FLOW_HISTORY_QUERY_LIMIT,
  });

  const seenMeasurements = new Set<string>();
  const recent: BtcEtfFlowPoint[] = [];
  for (const observation of history) {
    const measurementKey = observation.identity?.measurementId ?? observation.observedAt;
    if (seenMeasurements.has(measurementKey)) continue;
    seenMeasurements.add(measurementKey);
    const point = pointFromObservation(observation);
    if (point) recent.push(point);
    if (recent.length === BTC_ETF_FLOW_RECENT_SESSION_LIMIT) break;
  }
  if (history.length === BTC_ETF_FLOW_HISTORY_QUERY_LIMIT && recent.length < BTC_ETF_FLOW_RECENT_SESSION_LIMIT) {
    throw new Error("BTC ETF flow bounded history page cannot prove a complete five-session view.");
  }

  return {
    asOf: cutoff,
    seriesKey: BTC_ETF_NET_FLOW_SERIES_KEY,
    latest: recent[0] ?? null,
    previous: recent[1] ?? null,
    recent,
  };
}

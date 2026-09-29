import "server-only";
import type { FactualBaseline } from "../domain/baseline";
import { ingestDashboardData } from "../ingestion/dashboard-ingestion";
import { normalizeDashboardData, type NormalizedDashboardData } from "../normalization/dashboard-normalization";
import { historicalObservationRepository } from "../repositories/dashboard-repository";
import { buildRepositoryBackedMacroFactualBaselines } from "./factual-baseline";
import { getIntradayEventMonitor, type IntradayEventMonitor } from "./intraday-event-monitor";

export type DashboardData = NormalizedDashboardData & { macroBaselines: Record<string, FactualBaseline>; intradayEventMonitor: IntradayEventMonitor | null };

export async function getDashboardData(): Promise<DashboardData> {
  const ingestion = await ingestDashboardData();
  const normalized = normalizeDashboardData(ingestion);
  const macroBaselines = await buildRepositoryBackedMacroFactualBaselines(
    normalized.macroObservations,
    historicalObservationRepository,
  );

  const intradayEventMonitor = await getIntradayEventMonitor();

  // Dashboard rendering is a read/presentation path. Durable canonical writes
  // are owned by the authenticated cron ingestion workers so a page visit
  // cannot become a second ingestion/persistence clock.
  return { ...normalized, macroBaselines, intradayEventMonitor };
}

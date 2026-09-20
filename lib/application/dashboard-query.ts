import "server-only";
import type { FactualBaseline } from "../domain/baseline";
import { ingestDashboardData } from "../ingestion/dashboard-ingestion";
import { normalizeDashboardData, type NormalizedDashboardData } from "../normalization/dashboard-normalization";
import { canonicalRepositories, economicEventResultRepository, historicalObservationRepository, persistCanonicalDashboardData } from "../repositories/dashboard-repository";
import { buildRepositoryBackedMacroFactualBaselines } from "./factual-baseline";
export type DashboardData = NormalizedDashboardData & { macroBaselines: Record<string, FactualBaseline> };
export async function getDashboardData(): Promise<DashboardData> {
  const ingestion = await ingestDashboardData();
  const normalized = normalizeDashboardData(ingestion);
  const macroBaselines = await buildRepositoryBackedMacroFactualBaselines(
    normalized.macroObservations,
    historicalObservationRepository,
  );
  // Market Memory / economic-event-result persistence is a durability nice-to-have,
  // not the dashboard's primary output. A write failure there (schema drift, quota,
  // outage) must never take the whole page down — it already happened once
  // (17 Sep 2026, "captured_at" NOT NULL violation crashed the entire /dashboard route).
  try {
    await persistCanonicalDashboardData(canonicalRepositories, normalized);
  } catch (error) {
    console.error("[market-memory] persist failed, continuing without it:", error instanceof Error ? error.message : error);
  }
  try {
    await economicEventResultRepository.saveMany(normalized.economicEventResults);
  } catch (error) {
    console.error("[economic-event-result] saveMany failed, continuing without it:", error instanceof Error ? error.message : error);
  }
  return { ...normalized, macroBaselines };
}

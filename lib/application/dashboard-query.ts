import "server-only";
import { ingestDashboardData } from "../ingestion/dashboard-ingestion";
import { normalizeDashboardData, type NormalizedDashboardData } from "../normalization/dashboard-normalization";
import { canonicalRepositories, economicEventResultRepository, persistCanonicalDashboardData } from "../repositories/dashboard-repository";
export type DashboardData = NormalizedDashboardData;
export async function getDashboardData(): Promise<DashboardData> {
  const ingestion = await ingestDashboardData();
  const normalized = normalizeDashboardData(ingestion);
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
  return normalized;
}

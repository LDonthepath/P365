import "server-only";
import { ingestDashboardData } from "../ingestion/dashboard-ingestion";
import { normalizeDashboardData, type NormalizedDashboardData } from "../normalization/dashboard-normalization";
import { canonicalRepositories, persistCanonicalDashboardData } from "../repositories/dashboard-repository";
export type DashboardData = NormalizedDashboardData;
export async function getDashboardData(): Promise<DashboardData> { const ingestion = await ingestDashboardData(); const normalized = normalizeDashboardData(ingestion); await persistCanonicalDashboardData(canonicalRepositories, normalized); return normalized; }

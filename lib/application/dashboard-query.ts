import "server-only";

import { ingestDashboardData } from "../ingestion/dashboard-ingestion";
import { normalizeDashboardData, type NormalizedDashboardData } from "../normalization/dashboard-normalization";

export type DashboardData = NormalizedDashboardData;

export async function getDashboardData(): Promise<DashboardData> {
  const ingestion = await ingestDashboardData();
  return normalizeDashboardData(ingestion);
}

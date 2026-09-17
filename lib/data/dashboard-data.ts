import "server-only";

import { getDashboardData as getCanonicalDashboardData } from "../application/dashboard-query";
import type { NormalizedDashboardData } from "../normalization/dashboard-normalization";

/**
 * Compatibility boundary for existing dashboard consumers.
 *
 * The canonical dashboard read path lives in application/dashboard-query.ts:
 * ingestion → normalization → canonical persistence.
 * Keep this module as a thin adapter so legacy imports cannot reintroduce a
 * second provider orchestration path.
 */
export type DashboardData = NormalizedDashboardData;

export async function getDashboardData(): Promise<DashboardData> {
  return getCanonicalDashboardData();
}

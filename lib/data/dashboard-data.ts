import "server-only";

import { getDashboardData as getCanonicalDashboardData, type MacroDashboardData } from "../application/dashboard-query";

/**
 * Compatibility boundary for existing dashboard consumers.
 *
 * The canonical dashboard read path lives in application/dashboard-query.ts:
 * ingestion → normalization → canonical persistence.
 * Keep this module as a thin adapter so legacy imports cannot reintroduce a
 * second provider orchestration path.
 */
export type { MacroDashboardData };
// Type-only compatibility for retired, unmounted panels pending final cleanup.
export type { DashboardData } from "../application/legacy-dashboard-presentation-types";

export async function getDashboardData(): Promise<MacroDashboardData> {
  return getCanonicalDashboardData();
}

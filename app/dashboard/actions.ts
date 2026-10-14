"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { verifySession } from "@/lib/auth";
import { P365_DASHBOARD_CACHE_TAGS } from "@/lib/data/cache-policy";
import { historicalObservationRepository } from "@/lib/repositories/dashboard-repository";
import { withHistoricalObservationConcurrencyLimit } from "@/lib/application/historical-observation-concurrency";
import {
  buildMaterialMoveCrossAssetDiagnostic,
  type MaterialMoveCrossAssetDiagnosticAsset,
} from "@/lib/application/material-move-cross-asset-diagnostic";

// Every data-reading or cache-mutating dashboard action must fail closed.
async function assertDashboardSession(): Promise<void> {
  const session = await verifySession((await cookies()).get("market_briefing_session")?.value);
  if (!session) redirect("/login");
}

// Logout is intentionally safe and idempotent even for expired sessions.
export async function logout() {
  (await cookies()).delete("market_briefing_session");
  redirect("/login");
}

// Memaksa seluruh cache provider dashboard di-invalidasi sebelum render berikutnya,
// termasuk tag legacy dan semua cadence group yang dipakai provider saat ini.
export async function refreshDashboardData() {
  await assertDashboardSession();
  for (const tag of P365_DASHBOARD_CACHE_TAGS) {
    revalidateTag(tag);
  }
  return { refreshedAt: new Date().toISOString() };
}


export async function loadMaterialMoveCrossAssetDiagnostic(
  asset: MaterialMoveCrossAssetDiagnosticAsset,
) {
  await assertDashboardSession();
  const observations = withHistoricalObservationConcurrencyLimit(
    historicalObservationRepository,
    4,
  );
  return buildMaterialMoveCrossAssetDiagnostic({
    asset,
    observations,
    asOf: new Date().toISOString(),
  });
}

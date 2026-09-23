"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { P365_DASHBOARD_CACHE_TAGS } from "@/lib/data/cache-policy";

export async function logout() {
  (await cookies()).delete("market_briefing_session");
  redirect("/login");
}

// Memaksa seluruh cache provider dashboard di-invalidasi sebelum render berikutnya,
// termasuk tag legacy dan semua cadence group yang dipakai provider saat ini.
export async function refreshDashboardData() {
  for (const tag of P365_DASHBOARD_CACHE_TAGS) {
    revalidateTag(tag);
  }
  return { refreshedAt: new Date().toISOString() };
}

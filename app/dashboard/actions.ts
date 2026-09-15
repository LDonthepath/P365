"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";

export async function logout() {
  (await cookies()).delete("market_briefing_session");
  redirect("/login");
}

// Memaksa semua fetch provider (Alpha Vantage, CoinDesk, FMP) untuk
// mengambil data baru pada render berikutnya, bukan menunggu revalidate
// cache alami (15-30 menit). Dipanggil dari tombol "Muat ulang manual".
export async function refreshDashboardData() {
  revalidateTag("p365-dashboard");
  return { refreshedAt: new Date().toISOString() };
}

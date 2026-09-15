import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/src/backend/auth";
import { getDashboardData } from "@/src/backend/data/dashboard-data";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const session = await verifySession((await cookies()).get("market_briefing_session")?.value);
  if (!session) redirect("/login");

  return <DashboardView data={await getDashboardData()} sessionEmail={session.email} />;
}

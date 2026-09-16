import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard-data";
import { DashboardView } from "./dashboard-view";
import styles from "./dashboard-layout.module.css";

export default async function DashboardPage() {
  const session = await verifySession((await cookies()).get("market_briefing_session")?.value);
  if (!session) redirect("/login");

  return (
    <div className={styles.dashboardLayout}>
      <DashboardView data={await getDashboardData()} sessionEmail={session.email} />
    </div>
  );
}

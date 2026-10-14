import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { getDashboardData } from "@/lib/application/dashboard-query";
import { DashboardView } from "./dashboard-view";
import styles from "./dashboard-layout.module.css";
import overviewStyles from "./overview-layout.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await verifySession((await cookies()).get("market_briefing_session")?.value);
  if (!session) redirect("/login");
  const data = await getDashboardData();

  return (
    <div className={`${styles.dashboardLayout} ${overviewStyles.overviewLayout}`}>
      <DashboardView data={data} sessionEmail={session.email} />
    </div>
  );
}

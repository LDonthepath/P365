import { getDashboardData } from "@/lib/application/dashboard-query";
import { DashboardView } from "./dashboard-view";
import styles from "./dashboard-layout.module.css";
import overviewStyles from "./overview-layout.module.css";

export default async function DashboardPage() {
  return (
    <div className={`${styles.dashboardLayout} ${overviewStyles.overviewLayout}`}>
      <DashboardView data={await getDashboardData()} sessionEmail="audit-preview@local" />
    </div>
  );
}

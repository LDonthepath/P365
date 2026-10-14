"use client";

import type { DashboardData } from "@/lib/data/dashboard-data";
import { DashboardShell } from "./dashboard-shell";

export function DashboardView({ data, sessionEmail }: { data: DashboardData; sessionEmail: string }) {
  return <DashboardShell data={data} sessionEmail={sessionEmail} />;
}

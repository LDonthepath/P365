"use client";

import type { MacroDashboardData } from "@/lib/data/dashboard-data";
import { DashboardShell } from "./dashboard-shell";

export function DashboardView({ data, sessionEmail }: { data: MacroDashboardData; sessionEmail: string }) {
  return <DashboardShell data={data} sessionEmail={sessionEmail} />;
}

"use client";

import type { MacroDashboardData } from "@/lib/data/dashboard-data";
import { EventRiskWindowPanel } from "./event-risk-window-panel";

/** Calendar-only route: no Biquote expectation, market repricing or Snapshot. */
export function ContextSection({ data }: { data: MacroDashboardData }) {
  return <>
    <div className="page-intro">
      <span>KALENDER MAKRO</span>
      <h1>Jadwal ekonomi</h1>
      <p>Jadwal faktual Forex Factory dan Federal Reserve untuk AS, China dan Jepang.
        Daftar event bukan bukti cakupan sumber lengkap atau pergerakan harga.</p>
    </div>
    <EventRiskWindowPanel
      events={data.events}
      asOf={data.marketReadContext.knowledgeAsOf}
      forwardCoverage={data.calendarForwardCoverage}
    />
  </>;
}

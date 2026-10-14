"use client";

import type { DashboardData } from "@/lib/data/dashboard-data";
import { FactualMarketBriefingPanel } from "./factual-market-briefing-panel";
import { StandaloneMarketContextPanel } from "./standalone-market-context-panel";



export function OverviewSection({ data }: { data: DashboardData }) {
  return <>
        <div className="page-intro">
          <span>RINGKASAN</span>
          <h1>Ringkasan Pasar</h1>
          <p>Ringkasan hanya menampilkan kesimpulan faktual P365. Detail pasar, makro, crypto, Gold, catalyst, dan sumber data tersedia di bagian masing-masing.</p>
        </div>
        <div className="overview-briefing">
          <FactualMarketBriefingPanel data={data.factualMarketBriefing} />
        </div>
        <StandaloneMarketContextPanel data={data.standaloneMarketContext} />
      </>;
}

"use client";

import type { FactualMarketBriefing } from "@/lib/application/factual-market-briefing";
import {
  formatMacroDisplayDelta,
  formatMacroDisplayValue,
} from "@/lib/presentation/macro-display";

const SERIES_LABELS: Record<string, string> = {
  DGS2: "US Treasury 2Y",
  DGS10: "US Treasury 10Y",
  DFII10: "US 10Y Real Yield",
  T10YIE: "10Y Breakeven Inflation",
  T10Y2Y: "10Y–2Y Spread",
};

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FactualMarketBriefingPanel({ data }: { data: FactualMarketBriefing }) {
  const section = data.whatChanged;

  return <section className="panel overview-change-layer" aria-labelledby="briefing-what-changed-title">
    <div className="panel-label">
      <span>MARKET BRIEFING</span>
      <span>{section.evidenceStatus === "AVAILABLE" ? "DATA TERSEDIA" : "DATA BELUM CUKUP"}</span>
    </div>
    <div className="change-layer-grid">
      <div>
        <h2 id="briefing-what-changed-title">Apa yang berubah?</h2>
        <p className="lead-copy">Ringkasan baseline faktual Macro yang sudah tersedia di dashboard. Bagian ini hanya menyatukan data yang sudah ada dan tidak menambah kesimpulan baru.</p>
      </div>
    </div>

    {section.evidenceStatus === "AVAILABLE"
      ? <div className="monitor-list" style={{ marginTop: "1rem" }}>
          {section.items.map((item) => <div key={item.seriesId}>
            <strong>{SERIES_LABELS[item.seriesId] ?? item.subject}</strong>
            <span>
              Saat ini {formatMacroDisplayValue(item.currentValue, item.unit)}
              {" · "}sebelumnya {formatMacroDisplayValue(item.baselineValue, item.unit)}
              {" · "}{formatMacroDisplayDelta(item.changeValue, item.unit)}
            </span>
          </div>)}
        </div>
      : <div className="plain-notice" style={{ marginTop: "1rem" }}>
          <strong>Data belum cukup</strong>
          <span>{section.reason}</span>
        </div>}

    <div className="plain-notice" style={{ marginTop: "1rem" }}>
      <strong>Penalaran belum dievaluasi</strong>
      <span>Bagian ini belum menyimpulkan materialitas, kejutan terhadap ekspektasi, repricing pasar, transmisi lintas aset, konfirmasi, atau arah pasar.</span>
    </div>
    <p className="decision-meta">Cutoff briefing {dateTime(data.asOf)} WIB</p>
  </section>;
}

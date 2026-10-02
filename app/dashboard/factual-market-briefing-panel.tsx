"use client";

import type { FactualMarketBriefing } from "@/lib/application/factual-market-briefing";
import {
  formatMacroDisplayDelta,
  formatMacroDisplayValue,
} from "@/lib/presentation/macro-display";
import { formatEventResultValue } from "@/lib/presentation/intraday-event-response";

const SERIES_LABELS: Record<string, string> = {
  DGS2: "US Treasury 2Y",
  DGS10: "US Treasury 10Y",
  DFII10: "US 10Y Real Yield",
  T10YIE: "10Y Breakeven Inflation",
  T10Y2Y: "10Y–2Y Spread",
};

const PRICING_LABELS: Record<string, string> = {
  "btc.spot.usd": "Bitcoin",
  "eth.spot.usd": "Ethereum",
  "dxy.index.usd": "Dolar AS (DXY)",
  "gold.futures.usd": "Emas",
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

function expectationType(value: string): string {
  if (value === "CONSENSUS") return "konsensus";
  if (value === "OFFICIAL_PROJECTION") return "proyeksi resmi";
  return "perkiraan provider";
}

function pricingValue(value: number, unit: string | null): string {
  const normalized = unit?.trim().toLowerCase() ?? "";
  if (normalized === "usd" || normalized.includes("dollar")) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function FactualMarketBriefingPanel({ data }: { data: FactualMarketBriefing }) {
  const changed = data.whatChanged;
  const baselines = data.eventBaselines;

  return <section className="panel overview-change-layer" aria-labelledby="briefing-what-changed-title">
    <div className="panel-label">
      <span>MARKET BRIEFING</span>
      <span>{changed.evidenceStatus === "AVAILABLE" ? "DATA TERSEDIA" : "DATA BELUM CUKUP"}</span>
    </div>
    <div className="change-layer-grid">
      <div>
        <h2 id="briefing-what-changed-title">Apa yang berubah?</h2>
        <p className="lead-copy">Ringkasan baseline faktual Macro yang sudah tersedia di dashboard. Bagian ini hanya menyatukan data yang sudah ada dan tidak menambah kesimpulan baru.</p>
      </div>
    </div>

    {changed.evidenceStatus === "AVAILABLE"
      ? <div className="monitor-list" style={{ marginTop: "1rem" }}>
          {changed.items.map((item) => <div key={item.seriesId}>
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
          <span>{changed.reason}</span>
        </div>}

    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
      <div className="panel-label">
        <span>SEBELUM RILIS EVENT TERBARU</span>
        <span>{baselines.evidenceStatus === "AVAILABLE" ? "BASELINE TERSEDIA" : "BASELINE BELUM CUKUP"}</span>
      </div>
      <h3 style={{ margin: ".45rem 0 0" }}>Apa yang sudah diketahui sebelum rilis?</h3>
      <p className="lead-copy">Ekspektasi dan harga baseline diambil dari snapshot PRE yang sudah tersimpan. Angka ini belum digunakan untuk menyimpulkan repricing atau materialitas.</p>

      {baselines.evidenceStatus === "AVAILABLE"
        ? <div style={{ display: "grid", gap: ".85rem", marginTop: "1rem" }}>
            {baselines.events.map((event) => <div className="plain-notice" key={event.eventIdentityKey}>
              <strong>{event.subject}</strong>
              <span>{event.jurisdiction} · rilis {dateTime(event.releaseAt)} WIB · snapshot PRE {dateTime(event.preCapturedAt)} WIB</span>
              {event.expectation
                ? <span>
                    Baseline {expectationType(event.expectation.expectedType)}: {formatEventResultValue(event.expectation.expected, event.expectation.unit)}
                    {" · "}periode {event.expectation.period}
                  </span>
                : <span>Baseline ekspektasi yang memenuhi syarat belum tersedia.</span>}
              {event.pricing.length > 0
                ? <span>
                    Harga baseline: {event.pricing.map((item) =>
                      `${PRICING_LABELS[item.seriesKey] ?? item.seriesKey} ${pricingValue(item.value, item.unit)}`
                    ).join(" · ")}
                  </span>
                : <span>Baseline harga yang memenuhi syarat belum tersedia.</span>}
            </div>)}
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Baseline belum cukup</strong>
            <span>{baselines.reason}</span>
          </div>}
    </div>

    <div className="plain-notice" style={{ marginTop: "1rem" }}>
      <strong>Penalaran belum dievaluasi</strong>
      <span>Bagian ini belum menyimpulkan materialitas, makna surprise, repricing pasar, transmisi lintas aset, konfirmasi, atau arah pasar.</span>
    </div>
    <p className="decision-meta">Cutoff briefing {dateTime(data.asOf)} WIB</p>
  </section>;
}

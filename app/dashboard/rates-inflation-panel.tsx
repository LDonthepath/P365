"use client";

import type { RatesInflationReadModel, RatesSeriesPoint } from "@/lib/application/rates-inflation";

const LABELS: Record<RatesSeriesPoint["seriesKey"], string> = {
  DGS2: "Treasury AS 2 tahun",
  DGS10: "Treasury AS 10 tahun",
  DFII10: "Real yield AS 10 tahun",
  T10YIE: "Breakeven inflation 10 tahun",
  T10Y2Y: "Kurva 10Y–2Y",
};

function percent(value: number): string {
  return `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

function date(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function bps(value: number | null): string {
  if (value === null) return "Belum cukup riwayat";
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 0.05) return "tidak berubah";
  return `${rounded > 0 ? "naik" : "turun"} ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Math.abs(rounded))} bps`;
}

function SeriesCard({ point }: { point: RatesSeriesPoint }) {
  return <article className="panel" style={{ margin: 0 }}>
    <div className="panel-label"><span>{point.seriesKey}</span><span>{point.quality === "FRESH" ? "TERBARU" : "PERLU DICEK"}</span></div>
    <h3 style={{ marginBottom: ".35rem" }}>{LABELS[point.seriesKey]}</h3>
    <strong style={{ display: "block", fontSize: "1.55rem" }}>{percent(point.valuePercent)}</strong>
    <p className="muted" style={{ marginTop: ".35rem" }}>Observasi {date(point.observedAt)}</p>
    <div className="monitor-list" style={{ marginTop: ".75rem" }}>
      <div><strong>SEKITAR 1 MINGGU</strong><span>{bps(point.change1wBps)}{point.change1wFrom ? ` · dibanding ${date(point.change1wFrom)}` : ""}</span></div>
      <div><strong>SEKITAR 4 MINGGU</strong><span>{bps(point.change4wBps)}{point.change4wFrom ? ` · dibanding ${date(point.change4wFrom)}` : ""}</span></div>
    </div>
  </article>;
}

export function RatesInflationPanel({ data }: { data: RatesInflationReadModel }) {
  return <section className="panel" aria-labelledby="rates-inflation-title">
    <div className="panel-label"><span>SUKU BUNGA & EKSPEKTASI INFLASI</span><span>FAKTUAL · HARIAN</span></div>
    <h2 id="rates-inflation-title">Apa yang berubah di pasar Treasury dan ekspektasi inflasi?</h2>
    <p className="lead-copy">Perubahan dihitung dari observasi harian FRED yang tersimpan di Market Memory. Angka ini bukan pengukuran repricing intraday setelah event.</p>
    {data.status === "UNAVAILABLE"
      ? <p className="muted">{data.reason}</p>
      : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: ".75rem", marginTop: "1rem" }}>
          {data.series.map((point) => <SeriesCard key={point.seriesKey} point={point} />)}
        </div>}
    <p className="muted" style={{ marginBottom: 0 }}>P365 menampilkan perubahan yield, real yield, breakeven, dan kurva sebagai fakta. Panel ini belum menyimpulkan stance Fed, regime, atau implikasi bullish/bearish untuk Bitcoin.</p>
  </section>;
}

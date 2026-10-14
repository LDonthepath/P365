"use client";

import type { DashboardData } from "@/lib/data/dashboard-data";
import type { Observation } from "@/lib/domain/types";
import { relativeTimeID } from "@/lib/data/format";
import { EmptyPanelNote, numberValue, formatMoney, formatContracts, qualityLabel } from "./dashboard-common-ui";

function GoldPricePanel({ observations }: { observations: Observation[] }) {
  const observation = observations.find((item) => item.subject === "gold.futures.usd");
  const value = observation ? numberValue(observation.value) : null;
  return <section className="panel decision-panel" aria-labelledby="gold-market-title">
    <div className="panel-label"><span>HARGA GOLD</span><span>{observation ? qualityLabel(observation.quality) : "BELUM ADA DATA"}</span></div>
    <h2 id="gold-market-title">Gold futures</h2>
    <p className="lead-copy">Harga Gold dan posisi trader ditampilkan terpisah. P365 belum menyimpulkan bahwa satu posisi tertentu harus membuat harga naik atau turun.</p>
    {observation && value !== null ? <>
      <strong className="decision-value">{formatMoney(value)}</strong>
      <p className="decision-meta">COMEX GC=F · {relativeTimeID(observation.observedAt)}</p>
    </> : <EmptyPanelNote label="harga Gold" />}
    <div className="plain-notice"><strong>ETF Gold global</strong><span>Belum tersedia karena sumber runtime global yang memenuhi kontrak belum lolos kualifikasi.</span></div>
  </section>;
}

function GoldPositioningPanel({ data }: { data: DashboardData["goldPositioning"] }) {
  return <section className="panel decision-panel" aria-labelledby="gold-positioning-title">
    <div className="panel-label"><span>POSISI TRADER GOLD</span><span>{data.status === "AVAILABLE" ? "TERSEDIA" : "BELUM ADA DATA"}</span></div>
    <h2 id="gold-positioning-title">Managed Money di COMEX Gold</h2>
    <p className="lead-copy">Laporan mingguan CFTC. Angka di bawah adalah jumlah kontrak mentah; belum diubah menjadi net position, percentile, crowding, atau sinyal arah.</p>
    {data.status === "AVAILABLE" ? <>
      <p className="decision-meta">Laporan {data.reportDate} · CFTC Disaggregated Futures Only</p>
      <div className="position-grid">
        <div><span>Long</span><strong>{formatContracts(data.managedMoney.long.value)}</strong><small>kontrak sisi long</small></div>
        <div><span>Short</span><strong>{formatContracts(data.managedMoney.short.value)}</strong><small>kontrak sisi short</small></div>
        <div><span>Spreading</span><strong>{formatContracts(data.managedMoney.spreading.value)}</strong><small>posisi offset / spread</small></div>
      </div>
      <div className="plain-notice"><strong>Total open interest</strong><span>{formatContracts(data.openInterest.value)} kontrak terbuka</span></div>
    </> : <p className="muted">{data.reason}</p>}
  </section>;
}


export function GoldSection({ data }: { data: DashboardData }) {
  const { observations } = data;
  return <>
        <div className="page-intro"><span>GOLD</span><h1>Harga dan posisi trader</h1><p>Harga menjawab apa yang diperdagangkan sekarang. CFTC menjawab bagaimana kelompok Managed Money memegang kontrak pada laporan mingguan terakhir.</p></div>
        <div className="decision-grid">
          <GoldPricePanel observations={observations} />
          <GoldPositioningPanel data={data.goldPositioning} />
        </div>
      </>;
}

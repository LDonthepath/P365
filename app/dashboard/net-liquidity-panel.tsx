"use client";

import type { NetLiquidityReadModel } from "@/lib/application/net-liquidity";

function usd(v: number): string {
  return `$${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v)} miliar`;
}
function date(v: string | null): string {
  if (!v) return "—";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" }).format(new Date(v));
}
function change(v: number | null): string {
  if (v === null) return "Belum cukup riwayat";
  const direction = v > 0 ? "bertambah" : v < 0 ? "berkurang" : "tidak berubah";
  return `${direction} ${usd(Math.abs(v))}`;
}
function LiquidityHistory({ points }: { points: Array<{ asOf: string; valueBillionsUsd: number }> }) {
  if (points.length < 2) return <p className="muted">Riwayat bersama ketiga komponen belum cukup untuk grafik.</p>;
  const width = 720, height = 180, pad = 18;
  const values = points.map((p) => p.valueBillionsUsd);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const coords = points.map((p, i) => ({
    x: pad + (i / (points.length - 1)) * (width - pad * 2),
    y: pad + ((max - p.valueBillionsUsd) / span) * (height - pad * 2),
  }));
  const path = coords.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return <div style={{ marginTop: "1rem" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: ".75rem", flexWrap: "wrap" }}><strong>Riwayat proxy yang tersedia</strong><span className="muted">{date(points[0].asOf)} – {date(points[points.length - 1].asOf)}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Riwayat proxy likuiditas dolar AS dari ${date(points[0].asOf)} sampai ${date(points[points.length - 1].asOf)}`} style={{ width: "100%", height: "auto", marginTop: ".5rem" }}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
      {coords.map((p, i) => <circle key={points[i].asOf} cx={p.x} cy={p.y} r="3" fill="currentColor"><title>{date(points[i].asOf)} · {usd(points[i].valueBillionsUsd)}</title></circle>)}
    </svg>
    <p className="muted">Grafik dimulai saat ketiga komponen memiliki riwayat bersama. Titik hanya berasal dari data durable yang tersedia; tidak ada interpolasi.</p>
  </div>;
}

export function NetLiquidityPanel({ data }: { data: NetLiquidityReadModel }) {
  return <section className="panel" aria-labelledby="net-liquidity-title">
    <div className="panel-label"><span>LIKUIDITAS DOLAR AS</span><span>PROXY FAKTUAL</span></div>
    <h2 id="net-liquidity-title">Berapa likuiditas bersih yang terlihat dari neraca Fed?</h2>
    {data.status === "UNAVAILABLE"
      ? <p className="muted">{data.reason}</p>
      : <>
          <strong style={{ display: "block", fontSize: "1.6rem", marginTop: ".75rem" }}>{usd(data.latest.valueBillionsUsd)}</strong>
          <p className="muted" style={{ marginTop: ".35rem" }}>Dihitung dari aset Federal Reserve dikurangi kas Treasury dan dana yang ditempatkan di fasilitas reverse repo.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: ".75rem", marginTop: "1rem" }}>
            <div><small>SEKITAR 1 MINGGU</small><strong style={{ display: "block" }}>{change(data.change1wBillionsUsd)}</strong><span className="muted">dibanding data {date(data.change1wFrom)}</span></div>
            <div><small>SEKITAR 4 MINGGU</small><strong style={{ display: "block" }}>{change(data.change4wBillionsUsd)}</strong><span className="muted">dibanding data {date(data.change4wFrom)}</span></div>
          </div>
          <LiquidityHistory points={data.history} />
          <details style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Lihat komponen perhitungan</summary>
            <p className="muted">Aset Fed {usd(data.latest.fedAssetsBillionsUsd)} · Kas Treasury {usd(data.latest.treasuryCashBillionsUsd)} · Reverse repo {usd(data.latest.reverseRepoBillionsUsd)}.</p>
          </details>
          <p className="muted">Perubahan proxy ini adalah fakta aritmetika dari data resmi. P365 belum menyimpulkan bahwa kenaikan atau penurunannya bullish/bearish untuk Bitcoin.</p>
        </>}
  </section>;
}

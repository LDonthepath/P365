"use client";

import type { NetLiquidityReadModel } from "@/lib/application/net-liquidity";

function usd(v: number): string {
  return `$${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v)} miliar`;
}
function change(v: number | null): string {
  if (v === null) return "Belum cukup riwayat";
  const direction = v > 0 ? "bertambah" : v < 0 ? "berkurang" : "tidak berubah";
  return `${direction} ${usd(Math.abs(v))}`;
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
            <div><small>7 HARI</small><strong style={{ display: "block" }}>{change(data.change1wBillionsUsd)}</strong></div>
            <div><small>4 MINGGU</small><strong style={{ display: "block" }}>{change(data.change4wBillionsUsd)}</strong></div>
          </div>
          <details style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Lihat komponen perhitungan</summary>
            <p className="muted">Aset Fed {usd(data.latest.fedAssetsBillionsUsd)} · Kas Treasury {usd(data.latest.treasuryCashBillionsUsd)} · Reverse repo {usd(data.latest.reverseRepoBillionsUsd)}.</p>
          </details>
          <p className="muted">Perubahan proxy ini adalah fakta aritmetika dari data resmi. P365 belum menyimpulkan bahwa kenaikan atau penurunannya bullish/bearish untuk Bitcoin.</p>
        </>}
  </section>;
}

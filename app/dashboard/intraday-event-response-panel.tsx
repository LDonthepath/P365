"use client";

import type { IntradayEventMonitor, IntradaySeriesKey } from "@/lib/application/intraday-event-monitor";

const SERIES: Array<{ key: IntradaySeriesKey; label: string }> = [
  { key: "btc.spot.usd", label: "BTC" },
  { key: "eth.spot.usd", label: "ETH" },
  { key: "dxy.index.usd", label: "DXY" },
  { key: "gold.futures.usd", label: "GOLD" },
];
const ROLE_LABEL: Record<string, string> = { PRE: "PRE", T_PLUS_5: "T+5", T_PLUS_15: "T+15", T_PLUS_30: "T+30", T_PLUS_60: "T+60" };

function value(value: number | undefined, unit?: string): string {
  if (value === undefined) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}${unit ? " " + unit : ""}`;
}
function move(value: number | undefined): string {
  if (value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function time(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) + " WIB";
}

export function IntradayEventResponsePanel({ data }: { data: IntradayEventMonitor | null }) {
  return <section className="panel" aria-labelledby="intraday-event-response-title">
    <div className="panel-label"><span>INTRADAY EVENT RESPONSE</span><span>{data ? "DURABLE SNAPSHOT" : "BELUM ADA DATA"}</span></div>
    {!data ? <><h2 id="intraday-event-response-title">Belum ada event response terbaru.</h2><p className="muted">Panel ini akan menampilkan event HIGH terbaru yang memiliki durable PRE/T+ snapshot dalam 7 hari terakhir.</p></> : <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
        <div><h2 id="intraday-event-response-title" style={{ marginBottom: ".25rem" }}>{data.subject}</h2><p className="muted" style={{ margin: 0 }}>{data.jurisdiction} · rilis {time(data.t0)}</p></div>
        <strong>{data.missingRequirements === 0 ? "COMPLETE" : `${data.missingRequirements} MISSING`}</strong>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: ".75rem", marginTop: "1rem" }}>
        <div><small>ACTUAL</small><strong style={{ display: "block" }}>{value(data.actual, data.unit)}</strong></div>
        <div><small>FORECAST</small><strong style={{ display: "block" }}>{value(data.expected, data.unit)}</strong></div>
        <div><small>PREVIOUS</small><strong style={{ display: "block" }}>{value(data.previous, data.unit)}</strong></div>
      </div>
      <div style={{ overflowX: "auto", marginTop: "1rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead><tr><th style={{ textAlign: "left", padding: ".6rem" }}>ASSET</th>{data.moves.map((item) => <th key={item.role} style={{ textAlign: "right", padding: ".6rem" }}>{ROLE_LABEL[item.role] ?? item.role}</th>)}</tr></thead>
          <tbody>{SERIES.map((series) => <tr key={series.key}><th style={{ textAlign: "left", padding: ".6rem" }}>{series.label}</th>{data.moves.map((item) => <td key={item.role} style={{ textAlign: "right", padding: ".6rem" }}>{item.role === "PRE" ? value(item.values[series.key]) : move(item.changePct[series.key])}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>Perubahan dihitung terhadap PRE dari canonical Observation yang direferensikan durable Snapshot. Ini factual response, bukan sinyal entry/exit.</p>
    </>}
  </section>;
}

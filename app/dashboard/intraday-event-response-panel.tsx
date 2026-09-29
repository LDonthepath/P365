"use client";

import type { IntradayEventMonitorResult, IntradaySeriesKey } from "@/lib/application/intraday-event-monitor";
import type { EventWindowRole } from "@/lib/domain/event-window";

const SERIES: Array<{ key: IntradaySeriesKey; label: string }> = [
  { key: "btc.spot.usd", label: "BTC" },
  { key: "eth.spot.usd", label: "ETH" },
  { key: "dxy.index.usd", label: "DXY" },
  { key: "gold.futures.usd", label: "GOLD" },
];
const ROLES: EventWindowRole[] = ["PRE", "T_PLUS_5", "T_PLUS_15", "T_PLUS_30", "T_PLUS_60"];
const ROLE_LABEL: Record<EventWindowRole, string> = { PRE: "PRE", T_PLUS_5: "T+5", T_PLUS_15: "T+15", T_PLUS_30: "T+30", T_PLUS_60: "T+60" };

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
function surpriseLabel(relation: string): string {
  if (relation === "ABOVE_EXPECTATION") return "Di atas ekspektasi";
  if (relation === "BELOW_EXPECTATION") return "Di bawah ekspektasi";
  if (relation === "INLINE") return "Sesuai ekspektasi";
  return "Belum dapat ditentukan";
}
function surpriseMove(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function windowLabel(result: Extract<IntradayEventMonitorResult, { status: "OK" }>["data"]): string {
  const status = result.windowStatus;
  if (status.status === "COMPLETE") return "LENGKAP";
  if (status.status === "RUNNING") return `BERJALAN, menunggu ${ROLE_LABEL[status.nextRole]}`;
  return status.missingRole
    ? `TIDAK LENGKAP: ${ROLE_LABEL[status.missingRole]} tidak tertangkap`
    : "TIDAK LENGKAP: requirement snapshot belum lengkap";
}

export function IntradayEventResponsePanel({ result }: { result: IntradayEventMonitorResult }) {
  if (result.status === "EMPTY") {
    return <section className="panel" aria-labelledby="intraday-event-response-title">
      <div className="panel-label"><span>INTRADAY EVENT RESPONSE</span><span>BELUM ADA DATA</span></div>
      <h2 id="intraday-event-response-title">Belum ada event HIGH dengan snapshot dalam 7 hari terakhir.</h2>
    </section>;
  }
  if (result.status === "ERROR") {
    return <section className="panel" aria-labelledby="intraday-event-response-title">
      <div className="panel-label"><span>INTRADAY EVENT RESPONSE</span><span>ERROR</span></div>
      <h2 id="intraday-event-response-title">Gagal memuat data event response. Ini bukan berarti tidak ada event.</h2>
    </section>;
  }

  const data = result.data;
  return <section className="panel" aria-labelledby="intraday-event-response-title">
    <div className="panel-label"><span>INTRADAY EVENT RESPONSE</span><span>DURABLE SNAPSHOT</span></div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
      <div><h2 id="intraday-event-response-title" style={{ marginBottom: ".25rem" }}>{data.subject}</h2><p className="muted" style={{ margin: 0 }}>{data.jurisdiction} · rilis {time(data.t0)}</p></div>
      <strong>{windowLabel(data)}</strong>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: ".75rem", marginTop: "1rem" }}>
      <div><small>ACTUAL</small><strong style={{ display: "block" }}>{value(data.actual, data.unit)}</strong></div>
      <div><small>FORECAST</small><strong style={{ display: "block" }}>{value(data.expected, data.unit)}</strong></div>
      <div><small>PREVIOUS</small><strong style={{ display: "block" }}>{value(data.previous, data.unit)}</strong></div>
    </div>
    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
      <div className="panel-label"><span>FAKTUAL SURPRISE</span><span>{data.surprise?.status ?? "BELUM TERSEDIA"}</span></div>
      {data.surprise?.status === "VALID"
        ? <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: ".75rem" }}>
            <div><small>HASIL</small><strong style={{ display: "block" }}>{surpriseLabel(data.surprise.relation)}</strong></div>
            <div><small>SELISIH</small><strong style={{ display: "block" }}>{value(data.surprise.absoluteSurprise ?? undefined, data.surprise.unit ?? undefined)}</strong></div>
            <div><small>SELISIH %</small><strong style={{ display: "block" }}>{surpriseMove(data.surprise.percentSurprise)}</strong></div>
          </div>
        : <p className="muted" style={{ margin: 0 }}>{data.surprise?.reason ?? "Lineage forecast/actual yang sama belum dapat dibuktikan untuk event ini."}</p>}
      <p className="muted" style={{ marginBottom: 0 }}>Surprise hanya mengukur Actual terhadap expectation point-in-time dari source yang sama. Materialitas, repricing, transmisi, dan kausalitas belum dievaluasi.</p>
    </div>
    <div style={{ overflowX: "auto", marginTop: "1rem" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead><tr><th style={{ textAlign: "left", padding: ".6rem" }}>ASSET</th>{ROLES.map((role) => {
          const snapshot = data.moves.find((item) => item.role === role);
          return <th key={role} style={{ textAlign: "right", padding: ".6rem" }}>{ROLE_LABEL[role]}{snapshot && snapshot.quality !== "COMPLETE" ? <small style={{ display: "block" }}>{snapshot.quality}</small> : null}</th>;
        })}</tr></thead>
        <tbody>{SERIES.map((series) => <tr key={series.key}><th style={{ textAlign: "left", padding: ".6rem" }}>{series.label}</th>{ROLES.map((role) => {
          const item = data.moves.find((moveItem) => moveItem.role === role);
          return <td key={role} style={{ textAlign: "right", padding: ".6rem" }}>{!item ? "—" : role === "PRE" ? value(item.values[series.key]) : move(item.changePct[series.key])}</td>;
        })}</tr>)}</tbody>
      </table>
    </div>
    <p className="muted" style={{ marginBottom: 0 }}>Perubahan dihitung terhadap PRE dari canonical Observation yang direferensikan durable Snapshot. Ini factual response, bukan sinyal entry/exit.</p>
  </section>;
}

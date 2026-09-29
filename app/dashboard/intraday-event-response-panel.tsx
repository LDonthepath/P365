"use client";

import type { IntradayEventMonitor, IntradayEventMonitorResult, IntradaySeriesKey } from "@/lib/application/intraday-event-monitor";
import type { EventWindowRole } from "@/lib/domain/event-window";

const SERIES: Array<{ key: IntradaySeriesKey; label: string }> = [
  { key: "btc.spot.usd", label: "Bitcoin" },
  { key: "eth.spot.usd", label: "Ethereum" },
  { key: "dxy.index.usd", label: "Dolar AS (DXY)" },
  { key: "gold.futures.usd", label: "Emas" },
];
const ROLES: EventWindowRole[] = ["PRE", "T_PLUS_5", "T_PLUS_15", "T_PLUS_30", "T_PLUS_60"];
const ROLE_LABEL: Record<EventWindowRole, string> = { PRE: "Sebelum rilis", T_PLUS_5: "5 menit", T_PLUS_15: "15 menit", T_PLUS_30: "30 menit", T_PLUS_60: "1 jam" };

function value(v: number | undefined, unit?: string): string {
  if (v === undefined) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v)}${unit ? " " + unit : ""}`;
}
function move(v: number | undefined): string {
  if (v === undefined) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function time(v: string): string {
  if (!v) return "—";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v)) + " WIB";
}
function relationLabel(relation: string): string {
  if (relation === "ABOVE_EXPECTATION") return "lebih tinggi dari perkiraan";
  if (relation === "BELOW_EXPECTATION") return "lebih rendah dari perkiraan";
  if (relation === "INLINE") return "sesuai perkiraan";
  return "belum dapat dibandingkan dengan perkiraan";
}
function windowLabel(data: IntradayEventMonitor): string {
  if (data.windowStatus.status === "COMPLETE") return "Data reaksi 1 jam lengkap";
  if (data.windowStatus.status === "RUNNING") return `Masih memantau hingga ${ROLE_LABEL[data.windowStatus.nextRole]}`;
  return "Sebagian data reaksi tidak tersedia";
}
function reactionSentence(data: IntradayEventMonitor, key: IntradaySeriesKey, label: string): string | null {
  const preferredRoles: EventWindowRole[] = ["T_PLUS_60", "T_PLUS_30", "T_PLUS_15", "T_PLUS_5"];
  for (const role of preferredRoles) {
    const item = data.moves.find((entry) => entry.role === role);
    const change = item?.changePct[key];
    if (change === undefined) continue;
    const verb = change > 0 ? "naik" : change < 0 ? "turun" : "relatif datar";
    const amount = change === 0 ? "" : ` ${Math.abs(change).toFixed(2)}%`;
    return `${label} ${verb}${amount} setelah ${ROLE_LABEL[role].toLowerCase()}.`;
  }
  return null;
}

export function IntradayEventResponsePanel({ result }: { result: IntradayEventMonitorResult }) {
  if (result.status === "EMPTY") return <section className="panel" aria-labelledby="intraday-event-response-title">
    <div className="panel-label"><span>REAKSI PASAR SETELAH DATA EKONOMI</span><span>BELUM ADA DATA</span></div>
    <h2 id="intraday-event-response-title">Belum ada rilis berdampak tinggi yang bisa dibandingkan.</h2>
    <p className="muted">P365 akan menampilkan hasil rilis dan pergerakan Bitcoin, dolar, emas, serta Ethereum ketika datanya tersedia.</p>
  </section>;
  if (result.status === "ERROR") return <section className="panel" aria-labelledby="intraday-event-response-title">
    <div className="panel-label"><span>REAKSI PASAR SETELAH DATA EKONOMI</span><span>GAGAL MEMUAT</span></div>
    <h2 id="intraday-event-response-title">Data reaksi pasar sementara tidak dapat dimuat.</h2>
  </section>;

  return <>{result.data.map((data) => <IntradayEventResponseCard key={data.eventIdentityKey} data={data} />)}</>;
}

function IntradayEventResponseCard({ data }: { data: IntradayEventMonitor }) {
  const reactionLines = [
    reactionSentence(data, "btc.spot.usd", "Bitcoin"),
    reactionSentence(data, "dxy.index.usd", "Dolar AS"),
    reactionSentence(data, "gold.futures.usd", "Emas"),
  ].filter((line): line is string => Boolean(line));

  return <section className="panel" aria-labelledby="intraday-event-response-title">
    <div className="panel-label"><span>REAKSI PASAR SETELAH DATA EKONOMI</span><span>{windowLabel(data)}</span></div>
    <h2 id="intraday-event-response-title" style={{ marginBottom: ".35rem" }}>{data.subject}</h2>
    <p className="muted" style={{ margin: 0 }}>{data.jurisdiction} · dirilis {time(data.t0)}</p>

    <div style={{ marginTop: "1.1rem", padding: "1rem", border: "1px solid var(--line)", background: "var(--panel-2)" }}>
      {data.surprise?.status === "VALID"
        ? <>
            <strong style={{ display: "block", fontSize: "1.05rem" }}>Hasil rilis {relationLabel(data.surprise.relation)}.</strong>
            <p className="muted" style={{ margin: ".45rem 0 0" }}>Hasil aktual {value(data.actual, data.unit)}, dibanding perkiraan {value(data.expected, data.unit)} dan sebelumnya {value(data.previous, data.unit)}.</p>
          </>
        : <>
            <strong style={{ display: "block" }}>Hasil rilis tersedia, tetapi perbandingan dengan perkiraan belum dapat diverifikasi.</strong>
            <p className="muted" style={{ margin: ".45rem 0 0" }}>Aktual {value(data.actual, data.unit)} · perkiraan {value(data.expected, data.unit)} · sebelumnya {value(data.previous, data.unit)}.</p>
          </>}
    </div>

    <div style={{ marginTop: "1rem" }}>
      <strong>Apa yang terjadi di pasar?</strong>
      {reactionLines.length
        ? <ul style={{ margin: ".65rem 0 0", paddingLeft: "1.2rem", lineHeight: 1.8 }}>{reactionLines.map((line) => <li key={line}>{line}</li>)}</ul>
        : <p className="muted" style={{ marginTop: ".5rem" }}>Belum ada cukup data harga setelah rilis.</p>}
      <p className="muted" style={{ marginTop: ".65rem" }}>Ini menunjukkan pergerakan yang terjadi setelah rilis, bukan bukti bahwa rilis tersebut menyebabkan pergerakan dan bukan rekomendasi transaksi.</p>
    </div>

    <details style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Lihat detail pergerakan</summary>
      <div style={{ overflowX: "auto", marginTop: ".75rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
          <thead><tr><th style={{ textAlign: "left", padding: ".6rem" }}>Pasar</th>{ROLES.map((role) => <th key={role} style={{ textAlign: "right", padding: ".6rem" }}>{ROLE_LABEL[role]}</th>)}</tr></thead>
          <tbody>{SERIES.map((series) => <tr key={series.key}><th style={{ textAlign: "left", padding: ".6rem" }}>{series.label}</th>{ROLES.map((role) => {
            const item = data.moves.find((entry) => entry.role === role);
            return <td key={role} style={{ textAlign: "right", padding: ".6rem" }}>{!item ? "—" : role === "PRE" ? value(item.values[series.key]) : move(item.changePct[series.key])}</td>;
          })}</tr>)}</tbody>
        </table>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>Angka setelah rilis adalah perubahan terhadap harga sebelum rilis. Detail kualitas dan sumber tetap dipertahankan oleh sistem sebagai evidence.</p>
    </details>
  </section>;
}

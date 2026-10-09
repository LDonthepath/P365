import type { CSSProperties, ReactNode } from "react";

// Hanya menampilkan data siap-tampil; tidak menghitung status pasar atau freshness.
export type Direction = "up" | "down" | "flat" | "unknown";
export type EvidenceTone = "complete" | "partial" | "unavailable" | "neutral";

const directions: Record<Direction, string> = {
  up: "Naik", down: "Turun", flat: "Datar", unknown: "Arah belum tersedia",
};
const directionColors: Record<Direction, string> = {
  up: "var(--lime)", down: "var(--red)", flat: "var(--muted)", unknown: "var(--muted)",
};
const panel: CSSProperties = {
  minWidth: 0, padding: 18, border: "1px solid var(--line)", borderRadius: 10,
  background: "var(--panel)", color: "var(--text)",
};
const muted: CSSProperties = { color: "var(--muted)", fontSize: 12, lineHeight: 1.5 };
const textOrNull = (text: string | null | undefined) =>
  typeof text === "string" && text.trim() ? text : null;

export type StatusBadgeProps = { label: string; tone?: EvidenceTone };
/** Status kelengkapan bukti: tone berasal dari pemanggil, bukan klasifikasi komponen. */
export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const colors: Record<EvidenceTone, string> = {
    complete: "var(--lime)", partial: "var(--text)",
    unavailable: "var(--red)", neutral: "var(--muted)",
  };
  return <span style={{
    display: "inline-flex", alignItems: "center", maxWidth: "100%",
    padding: "5px 9px", border: "1px solid currentColor", borderRadius: 6,
    color: colors[tone], fontSize: 12, fontWeight: 650, lineHeight: 1.35,
    overflowWrap: "anywhere",
  }}>{textOrNull(label) ?? "Status belum tersedia"}</span>;
}

export type KpiCardProps = {
  label: string;
  value: string | null | undefined;
  valueDetail?: string | null;
  change?: {
    valueLabel: string | null;
    direction: Direction;
    comparisonLabel: string | null;
  } | null;
  badge?: ReactNode;
  /** Slot kosong secara bawaan, tanpa kalkulasi freshness. */
  freshnessSlot?: ReactNode;
};
export function KpiCard({ label, value, valueDetail, change, badge, freshnessSlot }: KpiCardProps) {
  const shownValue = textOrNull(value);
  const shownChange = textOrNull(change?.valueLabel);
  return <article aria-label={label} style={{ ...panel, display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
      <h3 style={{ margin: 0, color: "var(--text)", fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>{label}</h3>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        {badge}
        <span data-slot="freshness" style={{ fontSize: 12 }}>{freshnessSlot}</span>
      </div>
    </div>
    <strong style={{ fontSize: 32, lineHeight: 1.15, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
      {shownValue ?? "—"}
    </strong>
    {shownValue !== null && textOrNull(valueDetail)
      ? <span style={muted}>{valueDetail}</span>
      : null}
    {shownValue === null ? <span style={muted}>Data belum tersedia</span>
      : !change || shownChange === null ? <span style={muted}>Perubahan belum tersedia</span>
      : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ color: directionColors[change.direction], fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
          {shownChange} ({directions[change.direction].toLowerCase()})
        </span>
        <span style={muted}>{textOrNull(change.comparisonLabel) ?? "Periode pembanding belum tersedia"}</span>
      </div>}
  </article>;
}

export type SectionHeaderProps = {
  title: string;
  /** Satu kalimat faktual dari field yang sudah ada, disiapkan pemanggil. */
  summary: string | null | undefined;
  titleId?: string;
};
export function SectionHeader({ title, summary, titleId }: SectionHeaderProps) {
  return <header style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6, color: "var(--text)" }}>
    <h2 id={titleId} style={{ margin: 0, fontSize: 22, lineHeight: 1.25, overflowWrap: "anywhere" }}>{title}</h2>
    <p style={{ ...muted, margin: 0, fontSize: 14 }}>{textOrNull(summary) ?? "Data belum tersedia"}</p>
  </header>;
}

export type ChartHorizon = {
  label: string;
  valueLabel: string | null;
  direction: Direction;
  /** 0–100 dibanding skala bersama; panjang batang siap-tampil dari pemanggil. */
  barLengthPercent: number | null;
};
export type ChartCardProps = {
  title: string;
  horizons: readonly ChartHorizon[];
  description?: string | null;
};
const valid = (h: ChartHorizon) =>
  textOrNull(h.valueLabel) !== null && typeof h.barLengthPercent === "number"
  && Number.isFinite(h.barLengthPercent) && h.direction !== "unknown";
const display = (h: ChartHorizon) =>
  valid(h) ? h.valueLabel + " (" + directions[h.direction].toLowerCase() + ")" : "tidak tersedia";

/** Batang SVG murni geometri; data kosong tidak diganti angka nol. */
export function ChartCard({ title, horizons, description }: ChartCardProps) {
  return <section aria-label={title} style={{ ...panel, display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.35 }}>{title}</h3>
      {textOrNull(description) && <p style={{ ...muted, margin: 0 }}>{description}</p>}
    </div>
    {horizons.length === 0 ? <p style={{ ...muted, margin: 0 }}>Data belum tersedia</p> : <>
      <div role="group" aria-label={"Grafik perbandingan perubahan: " + title} style={{ display: "grid", gap: 14 }}>
        {horizons.map((h, i) => {
          const has = valid(h);
          const label = display(h);
          const length = has ? Math.max(0, Math.min(100, h.barLengthPercent!)) * 0.45 : 0;
          const x = h.direction === "down" ? 50 - length : 50;
          return <div key={h.label + i} style={{
            display: "grid", gridTemplateColumns: "minmax(75px, 1fr) minmax(80px, 2fr) minmax(90px, 1.4fr)",
            alignItems: "center", gap: 10, minWidth: 0,
          }}>
            <span style={{ fontSize: 12, overflowWrap: "anywhere" }}>{h.label}</span>
            {has ? <svg role="img" aria-label={h.label + ": " + label} viewBox="0 0 100 12"
              preserveAspectRatio="none" style={{ width: "100%", height: 22, display: "block" }}>
              <title>{h.label + ": " + label}</title>
              <line x1="50" y1="0" x2="50" y2="12" stroke="var(--muted)" strokeWidth="0.6" />
              <rect x={h.direction === "flat" ? 49.5 : x} y="2"
                width={h.direction === "flat" ? 1 : length} height="8" rx="1"
                fill={directionColors[h.direction]} />
            </svg> : <span style={muted}>tidak tersedia</span>}
            <span style={{
              fontSize: 12, lineHeight: 1.5, fontWeight: 650, overflowWrap: "anywhere",
              color: has ? directionColors[h.direction] : "var(--muted)",
            }}>{label}</span>
          </div>;
        })}
      </div>
      <details style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--text)", padding: "6px 0" }}>
          Lihat rincian data
        </summary>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 12, textAlign: "left" }}>
            <caption style={{ ...muted, textAlign: "left", marginBottom: 8 }}>Perubahan menurut rentang pengamatan</caption>
            <thead><tr>{(["Rentang", "Perubahan", "Arah"] as const).map((heading) =>
              <th key={heading} scope="col" style={{ padding: "8px 10px 8px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
                {heading}
              </th>)}</tr></thead>
            <tbody>{horizons.map((h, i) => <tr key={h.label + i}>
              <th scope="row" style={{ padding: "9px 10px 9px 0", borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 500 }}>{h.label}</th>
              <td style={{ padding: "9px 10px 9px 0", borderBottom: "1px solid var(--line)" }}>{valid(h) ? h.valueLabel : "tidak tersedia"}</td>
              <td style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}>{valid(h) ? directions[h.direction] : "tidak tersedia"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </>}
  </section>;
}

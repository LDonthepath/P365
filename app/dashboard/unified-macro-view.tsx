"use client";

import type { DataQuality } from "@/lib/domain/types";
import type { UnifiedMacroKey, UnifiedMacroPoint } from "@/lib/application/rates-inflation";
import { KpiCard, SectionHeader, StatusBadge } from "./components/briefing-primitives";

const DEFINITIONS: { key: UnifiedMacroKey; label: string; source: string }[] = [
  { key: "dxy.index.usd", label: "Dolar AS (DXY · ICE)", source: "Yahoo Finance · DX-Y.NYB" },
  { key: "DGS2", label: "Treasury AS 2 tahun", source: "FRED · DGS2" },
  { key: "DFII10", label: "Real yield AS 10 tahun", source: "FRED · DFII10" },
];
const QUALITY: Record<DataQuality, string> = {
  FRESH: "TERBARU SAAT DIPEROLEH", STALE: "SUDAH LAMA SAAT DIPEROLEH",
  PARTIAL: "DATA SEBAGIAN", UNKNOWN: "KUALITAS BELUM PASTI",
};
const RECENCY: Record<DataQuality, string> = {
  FRESH: "Dalam batas waktu kebijakan yang berlaku", STALE: "Melewati batas waktu kebijakan yang berlaku",
  PARTIAL: "Ketepatan waktu sebagian", UNKNOWN: "Ketepatan waktu belum diketahui",
};
function number(value: number, signed = false, digits = 2): string {
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits,
    signDisplay: signed ? "exceptZero" : "auto" }).format(value);
}
function observationTime(value: string, dxy: boolean): string {
  if (!dxy) return `${value.slice(0, 10)} · tanggal harian FRED`;
  return `${new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))} UTC`;
}

/** Pure presentation of the shared Rates & Policy read model; performs no fetch. */
export function UnifiedMacroView({ points = [] }: { points?: UnifiedMacroPoint[] }) {
  const available = points.filter((point) => point.latest !== null).length;
  return <section aria-label="Dolar dan yield AS" style={{ marginTop: "1rem", minWidth: 0 }}>
    <SectionHeader title="Bagaimana kondisi dolar dan yield AS?"
      summary={`DXY, Treasury 2 tahun, dan real yield 10 tahun tersedia ${available} dari 3 seri; waktu observasi dibaca terpisah.`} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: ".75rem", marginTop: ".75rem" }}>
      {DEFINITIONS.map(({ key, label, source }) => {
        const point = points.find((item) => item.seriesKey === key);
        const latest = point?.latest;
        const previous = point?.previous;
        const dxy = key === "dxy.index.usd";
        const unit = dxy ? " poin indeks" : "%";
        const change = point?.change ?? null;
        return <div key={key} style={{ minWidth: 0 }}>
          <KpiCard label={label} value={latest ? number(latest.value, false, dxy ? 3 : 2) + unit : null}
            valueDetail={latest ? `Observasi ${observationTime(latest.observedAt, dxy)}` : null}
            change={change !== null && previous ? {
              valueLabel: number(change, true, dxy ? 3 : 2) + (dxy ? " poin indeks" : " bps"),
              direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
              comparisonLabel: `vs observasi valid sebelumnya ${number(previous.value, false, dxy ? 3 : 2)}${unit} · ${observationTime(previous.observedAt, dxy)}`,
            } : null}
            badge={<StatusBadge label={latest ? QUALITY[latest.quality] : "TIDAK TERSEDIA / BELUM TERKUALIFIKASI"}
              tone={latest ? "neutral" : "unavailable"} />} />
          <p className="muted" style={{ fontSize: 12, overflowWrap: "anywhere" }}>
            Sumber: {source} · {dxy ? "ICE U.S. Dollar Index; quote bertimestamp provider" : "Data harian, bukan yield intraday"}.
          </p>
          {latest && <p className="muted" style={{ fontSize: 12 }}>
            {RECENCY[latest.freshness]}. Diperoleh {observationTime(latest.retrievedAt, true)}.
          </p>}
          {point?.reason && <p className="muted" style={{ fontSize: 12 }}>{point.reason}</p>}
        </div>;
      })}
    </div>
    <details className="briefing-rate-details">
      <summary>Baca metode dan keterbatasan data</summary>
      <p>Perubahan DXY = nilai terakhir − observasi valid sebelumnya (poin indeks). Perubahan yield = selisih nilai persen × 100 bps. Pembanding berasal dari seri yang sama, bukan previous close metadata Yahoo.</p>
      <p>Hari tanpa observasi, termasuk akhir pekan atau hari libur, dilewati; tanggal pembanding tetap ditampilkan. Tidak ada interpolasi atau carry-forward.</p>
      <p>Yahoo memakai endpoint chart tidak resmi; keterlambatan quote tidak dijamin. Ketepatan waktu DXY memakai sesi mingguan ICE yang berlaku; kalender hari libur dan penutupan lebih awal belum dimodelkan. FRED memakai toleransi frekuensi harian yang berlaku, bukan jam rilis atau quote intraday.</p>
      <p>Riwayat dibaca secara terbatas (maksimal 100 baris per seri; FRED 21 hari). Data kosong atau riwayat pembanding tidak cukup tetap ditampilkan sebagai gap. Tampilan ini tidak menyimpulkan penyebab pergerakan Bitcoin atau Emas.</p>
    </details>
  </section>;
}

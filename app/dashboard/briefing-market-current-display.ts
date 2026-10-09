import type { BriefingMarketMove, FactualMarketBriefing } from "@/lib/application/factual-market-briefing";
import type { ChartHorizon, Direction, EvidenceTone } from "./components/briefing-primitives";
import { formatBriefingNumber, formatBriefingPercent } from "./briefing-number-format";

const HORIZONS = [15, 30, 60, 120] as const;
const measured = (status: string) =>
  status === "MATERIAL_MOVE" || status === "BELOW_MATERIALITY_THRESHOLD";
const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);
const direction = (value: number): Direction => value > 0 ? "up" : value < 0 ? "down" : "flat";
const signed = (value: number): string => formatBriefingPercent(value);

/** Adaptasi format dan geometri visual saja; tidak menetapkan materialitas/kualitas/freshness. */
export function presentMarketMove(item: BriefingMarketMove) {
  const context = item.marketContext;
  const current = context?.currentValue;
  const price = finite(current)
    ? `US$ ${formatBriefingNumber(current, {
        minimumFractionDigits: item.asset === "BTC" ? 0 : 2,
        maximumFractionDigits: item.asset === "BTC" ? 0 : 2,
      })}`
    : null;

  const comparisonLabel = context?.changeBasis === "ROLLING_24H"
    ? "Perubahan dalam 24 jam"
    : context?.changeBasis === "PREVIOUS_CLOSE"
      ? "Perubahan terhadap penutupan sebelumnya"
      : "Basis perubahan belum tersedia";
  const change = context && finite(context.changePercent)
    ? { valueLabel: signed(context.changePercent), direction: direction(context.changePercent), comparisonLabel }
    : null;

  const values = HORIZONS.map((minutes) => {
    const source = item.horizons.find((candidate) => candidate.horizonMinutes === minutes);
    return source && measured(source.status) && finite(source.signedPercentChange)
      ? source.signedPercentChange : null;
  });
  // Skala 0–100 hanya menentukan panjang batang relatif antar horizon yang terukur.
  // Ini bukan ambang materialitas atau metrik pasar baru.
  const visualMax = Math.max(0, ...values.filter(finite).map((value) => Math.abs(value)));
  const horizons: ChartHorizon[] = HORIZONS.map((minutes, index) => {
    const value = values[index];
    return {
      label: `${minutes} menit`,
      valueLabel: finite(value) ? signed(value) : null,
      direction: finite(value) ? direction(value) : "unknown",
      barLengthPercent: finite(value) ? (visualMax > 0 ? Math.abs(value) / visualMax * 100 : 0) : null,
    };
  });

  const completeness = item.evidence?.evidenceCompleteness;
  const badge: { label: string; tone: EvidenceTone } | null = !item.evidence
    ? null
    : completeness === "EVIDENCE_COMPLETE"
      ? { label: "Bukti lengkap", tone: "complete" }
      : completeness === "EVIDENCE_INCOMPLETE"
        ? { label: "Bukti pendukung belum lengkap", tone: "partial" }
        : { label: "Status bukti pendukung belum tersedia", tone: "neutral" };

  return { price, priceDetail: item.asset === "BTC" ? "per 1 BTC" : null, change, horizons, badge };
}

export function marketCurrentSummary(moves: FactualMarketBriefing["marketMoves"]): string | null {
  if (moves.evidenceStatus !== "AVAILABLE") return null;
  if (moves.materialMoveCount > 0) {
    return `${moves.materialMoveCount} pergerakan intraday tidak biasa terdeteksi pada pengamatan ini.`;
  }
  return "Tidak ada pergerakan intraday material pada waktu pengamatan ini.";
}

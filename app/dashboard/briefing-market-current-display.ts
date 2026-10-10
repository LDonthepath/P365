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
  const badge: { label: string; tone: EvidenceTone } | null =
    completeness === "EVIDENCE_COMPLETE"
      ? { label: "Bukti lengkap", tone: "complete" }
      : completeness === "EVIDENCE_INCOMPLETE"
        ? { label: "Bukti pendukung belum lengkap", tone: "partial" }
        : item.hasMaterialMove
          ? { label: "Bukti pergerakan material belum tersedia untuk dinilai", tone: "neutral" }
          : null;

  return { price, priceDetail: item.asset === "BTC" ? "per 1 BTC" : null, change, horizons, badge };
}

export const MOVE_INSTRUMENT_LABELS = {
  BTC: "BTC",
  GOLD: "Emas berjangka COMEX (GC=F)",
} as const;

const ASSESSMENT_LABELS: Record<BriefingMarketMove["status"], string> = {
  MATERIAL_MOVE: "pergerakan material terdeteksi; rincian pengukuran belum lengkap",
  BELOW_MATERIALITY_THRESHOLD: "di bawah ambang materialitas",
  INSUFFICIENT_DATA: "data belum cukup untuk menentukan materialitas",
  UNKNOWN: "penilaian belum dapat dipastikan",
  UNAVAILABLE: "observasi tidak tersedia",
  INCOMPATIBLE: "data tidak kompatibel untuk menentukan materialitas",
};

/** Only ranks existing MATERIAL_MOVE results. Ties: longer horizon, BTC before GOLD.
 * No return calculation, detector, threshold, or synthetic start time here.
 */
export function dominantMaterialMove(moves: FactualMarketBriefing["marketMoves"]) {
  const candidates = moves.items.flatMap((item) => {
    if (item.status !== "MATERIAL_MOVE" || !item.hasMaterialMove) return [];
    return item.horizons.flatMap((horizon) => {
      const start = horizon.targetStartObservedAt;
      const end = horizon.targetEndObservedAt;
      if (horizon.status !== "MATERIAL_MOVE" || !finite(horizon.signedPercentChange)
        || !HORIZONS.includes(horizon.horizonMinutes as typeof HORIZONS[number])
        || !start || !end || !Number.isFinite(Date.parse(start))
        || !Number.isFinite(Date.parse(end)) || Date.parse(start) >= Date.parse(end)) return [];
      return [{ item, horizon, startAt: start, endAt: end, signedPercentChange: horizon.signedPercentChange }];
    });
  });
  return candidates.sort((a, b) =>
    Math.abs(b.signedPercentChange) - Math.abs(a.signedPercentChange)
    || b.horizon.horizonMinutes - a.horizon.horizonMinutes
    || a.item.asset.localeCompare(b.item.asset)
    || a.startAt.localeCompare(b.startAt)
    || a.endAt.localeCompare(b.endAt)
  )[0] ?? null;
}

function observationTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

export function marketCurrentSummary(moves: FactualMarketBriefing["marketMoves"]): string {
  const selected = dominantMaterialMove(moves);
  if (selected) {
    const { item, horizon, signedPercentChange, startAt, endAt } = selected;
    const verb = signedPercentChange > 0 ? "naik" : signedPercentChange < 0 ? "turun" : "tidak berubah";
    const evidence = presentMarketMove(item).badge?.label ?? "Status bukti belum tersedia";
    return `${MOVE_INSTRUMENT_LABELS[item.asset]} ${verb} ${signed(signedPercentChange)} pada horizon ${horizon.horizonMinutes} menit, pengamatan ${observationTime(startAt)}–${observationTime(endAt)} WIB. ${evidence}. Penyebab belum dinilai.`;
  }
  if (moves.items.length === 0) return "Data pemantauan BTC dan Emas berjangka COMEX (GC=F) belum tersedia untuk menentukan materialitas.";
  const allBelow = moves.items.length === 2
    && moves.items.every((item) => item.status === "BELOW_MATERIALITY_THRESHOLD");
  return `${allBelow ? "Tidak ada pergerakan intraday material pada penilaian yang tersedia. " : ""}${moves.items.map((item) =>
    `${MOVE_INSTRUMENT_LABELS[item.asset]}: ${ASSESSMENT_LABELS[item.status]}`
  ).join("; ")}.`;
}

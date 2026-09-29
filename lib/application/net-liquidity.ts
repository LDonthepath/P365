import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

const DAY = 24 * 60 * 60 * 1000;
const SERIES = ["WALCL", "WTREGEN", "RRPONTSYD"] as const;

export type NetLiquidityPoint = {
  asOf: string;
  valueBillionsUsd: number;
  fedAssetsBillionsUsd: number;
  treasuryCashBillionsUsd: number;
  reverseRepoBillionsUsd: number;
  quality: DataQuality;
};

export type NetLiquidityReadModel =
  | { status: "OK"; latest: NetLiquidityPoint; change1wBillionsUsd: number | null; change1wFrom: string | null; change4wBillionsUsd: number | null; change4wFrom: string | null; history: NetLiquidityPoint[] }
  | { status: "UNAVAILABLE"; reason: string };

function seriesKey(o: Observation): string | null {
  return o.identity?.seriesKey ?? (typeof o.metadata?.seriesId === "string" ? o.metadata.seriesId : null);
}
function toBillions(o: Observation): number | null {
  const n = Number(o.value);
  if (!Number.isFinite(n)) return null;
  const key = seriesKey(o);
  if (key === "WALCL" || key === "WTREGEN") return n / 1000;
  if (key === "RRPONTSYD") return n;
  return null;
}
function latestOnOrBefore(rows: Observation[], key: string, at: number): Observation | null {
  return rows
    .filter((o) => seriesKey(o) === key && Date.parse(o.observedAt) <= at)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt))[0] ?? null;
}
function quality(rows: Observation[]): DataQuality {
  if (rows.some((o) => o.quality === "STALE")) return "STALE";
  if (rows.some((o) => o.quality === "PARTIAL")) return "PARTIAL";
  if (rows.some((o) => o.quality === "UNKNOWN")) return "UNKNOWN";
  return "FRESH";
}
function point(rows: Observation[], at: number): NetLiquidityPoint | null {
  const walcl = latestOnOrBefore(rows, "WALCL", at);
  const tga = latestOnOrBefore(rows, "WTREGEN", at);
  const rrp = latestOnOrBefore(rows, "RRPONTSYD", at);
  if (!walcl || !tga || !rrp) return null;
  const fed = toBillions(walcl), treasury = toBillions(tga), reverseRepo = toBillions(rrp);
  if (fed === null || treasury === null || reverseRepo === null) return null;
  return {
    asOf: new Date(Math.max(Date.parse(walcl.observedAt), Date.parse(tga.observedAt), Date.parse(rrp.observedAt))).toISOString(),
    valueBillionsUsd: fed - treasury - reverseRepo,
    fedAssetsBillionsUsd: fed,
    treasuryCashBillionsUsd: treasury,
    reverseRepoBillionsUsd: reverseRepo,
    quality: quality([walcl, tga, rrp]),
  };
}

export async function buildNetLiquidityReadModel(repository: HistoricalObservationRepository, asOf = new Date()): Promise<NetLiquidityReadModel> {
  const end = asOf.toISOString();
  const start = new Date(asOf.getTime() - 40 * DAY).toISOString();
  const histories = await Promise.all(SERIES.map((seriesKey) => repository.findHistory({
    identity: { domain: "MACRO", seriesKey },
    observedAtOnOrAfter: start,
    observedAtOnOrBefore: end,
    retrievedAtOnOrBefore: end,
    order: "ASC",
    limit: 100,
  })));
  const rows = histories.flat();
  const latest = point(rows, asOf.getTime());
  if (!latest) return { status: "UNAVAILABLE", reason: "Komponen likuiditas belum lengkap." };
  const p1w = point(rows, asOf.getTime() - 7 * DAY);
  const p4w = point(rows, asOf.getTime() - 28 * DAY);
  const walclDates = rows.filter((o) => seriesKey(o) === "WALCL").map((o) => Date.parse(o.observedAt));
  const tgaDates = new Set(rows.filter((o) => seriesKey(o) === "WTREGEN").map((o) => Date.parse(o.observedAt)));
  const actualWeeklyAnchors = [...new Set(walclDates.filter((at) => tgaDates.has(at)))].sort((a, b) => a - b);
  const weeklyHistory = actualWeeklyAnchors
    .map((at) => point(rows, at))
    .filter((p): p is NetLiquidityPoint => Boolean(p));

  return {
    status: "OK",
    latest,
    change1wBillionsUsd: p1w ? latest.valueBillionsUsd - p1w.valueBillionsUsd : null,
    change1wFrom: p1w?.asOf ?? null,
    change4wBillionsUsd: p4w ? latest.valueBillionsUsd - p4w.valueBillionsUsd : null,
    change4wFrom: p4w?.asOf ?? null,
    history: weeklyHistory,
  };
}

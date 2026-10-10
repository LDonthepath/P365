import type { Observation } from "../domain/types";
import type { BaselinePresentation } from "./baseline";
import type { MaterialMoveMonitorReadModel } from "../application/material-move-monitor";
import type { UnifiedMacroPoint } from "../application/rates-inflation";

/**
 * FMKT-001. Read-only, coverage-first projection of existing canonical facts.
 * Does not query providers, persist, infer causality or calculate new materiality.
 */
export type FinancialDomain =
  | "USD & FX"
  | "Rates & Bonds"
  | "Equities & Risk"
  | "Commodities"
  | "Credit & Funding"
  | "Crypto";

export type FinancialCoverage = "TERSEDIA" | "SEBAGIAN" | "BELUM TERSEDIA";

type Unit = "USD" | "USD_PER_BARREL" | "INDEX" | "PERCENT" | "JPY_PER_USD" | "CNH_PER_USD";
type ChangeUnit = "BPS" | "INDEX_POINTS" | "PERCENTAGE_POINTS" | "USD" | "UNAVAILABLE";
type Definition = {
  key: string;
  name: string;
  domain: FinancialDomain;
  sourceId: string;
  cadence: string;
  unit: Unit;
  changeUnit: ChangeUnit;
  note?: string;
};

const DEFINITIONS: readonly Definition[] = [
  { domain: "USD & FX", key: "dxy.index.usd", name: "ICE U.S. Dollar Index (DXY)", sourceId: "yahoo-finance", cadence: "Sesi pasar", unit: "INDEX", changeUnit: "INDEX_POINTS" },
  { domain: "USD & FX", key: "fx.usdjpy.jpy_per_usd", name: "USD/JPY", sourceId: "yahoo-finance", cadence: "Sesi pasar", unit: "JPY_PER_USD", changeUnit: "UNAVAILABLE" },
  { domain: "USD & FX", key: "fx.usdcnh.cnh_per_usd", name: "USD/CNH", sourceId: "yahoo-finance", cadence: "Sesi pasar", unit: "CNH_PER_USD", changeUnit: "UNAVAILABLE" },
  { domain: "Rates & Bonds", key: "DGS2", name: "US Treasury 2Y", sourceId: "fred", cadence: "Harian", unit: "PERCENT", changeUnit: "BPS" },
  { domain: "Rates & Bonds", key: "DGS10", name: "US Treasury 10Y", sourceId: "fred", cadence: "Harian", unit: "PERCENT", changeUnit: "BPS" },
  { domain: "Rates & Bonds", key: "DFII10", name: "US 10Y Real Yield", sourceId: "fred", cadence: "Harian", unit: "PERCENT", changeUnit: "BPS" },
  { domain: "Equities & Risk", key: "SP500", name: "S&P 500", sourceId: "fred", cadence: "Harian", unit: "INDEX", changeUnit: "INDEX_POINTS" },
  { domain: "Equities & Risk", key: "NASDAQCOM", name: "Nasdaq Composite (bukan NDX)", sourceId: "fred", cadence: "Harian", unit: "INDEX", changeUnit: "INDEX_POINTS" },
  { domain: "Equities & Risk", key: "russell2000.index.usd", name: "Russell 2000", sourceId: "yahoo-finance", cadence: "Sesi pasar", unit: "INDEX", changeUnit: "UNAVAILABLE" },
  { domain: "Equities & Risk", key: "VIXCLS", name: "VIX", sourceId: "fred", cadence: "Harian", unit: "INDEX", changeUnit: "INDEX_POINTS" },
  { domain: "Commodities", key: "gold.futures.usd", name: "Emas berjangka COMEX (GC=F)", sourceId: "yahoo-finance", cadence: "Sesi pasar", unit: "USD", changeUnit: "UNAVAILABLE", note: "Bukan XAU/USD Spot" },
  { domain: "Commodities", key: "DCOILWTICO", name: "WTI", sourceId: "fred", cadence: "Harian", unit: "USD_PER_BARREL", changeUnit: "USD" },
  { domain: "Commodities", key: "copper.market.usd", name: "Copper", sourceId: "", cadence: "Belum ada", unit: "USD", changeUnit: "UNAVAILABLE", note: "Belum ada seri canonical qualified" },
  { domain: "Credit & Funding", key: "BAMLH0A0HYM2", name: "US HY Credit OAS", sourceId: "fred", cadence: "Harian", unit: "PERCENT", changeUnit: "BPS" },
  { domain: "Credit & Funding", key: "BAMLC0A0CM", name: "US IG Credit OAS", sourceId: "fred", cadence: "Harian", unit: "PERCENT", changeUnit: "BPS" },
  { domain: "Credit & Funding", key: "SOFR", name: "SOFR", sourceId: "fred", cadence: "Harian", unit: "PERCENT", changeUnit: "BPS" },
  { domain: "Crypto", key: "btc.spot.usd", name: "BTC Spot", sourceId: "coingecko-market", cadence: "Intraday", unit: "USD", changeUnit: "UNAVAILABLE" },
  { domain: "Crypto", key: "eth.spot.usd", name: "ETH Spot", sourceId: "coingecko-market", cadence: "Intraday", unit: "USD", changeUnit: "UNAVAILABLE" },
  { domain: "Crypto", key: "crypto.btc_dominance.pct", name: "Dominasi BTC", sourceId: "coingecko-market", cadence: "Intraday", unit: "PERCENT", changeUnit: "PERCENTAGE_POINTS" },
];

const DOMAINS: FinancialDomain[] = [
  "USD & FX", "Rates & Bonds", "Equities & Risk",
  "Commodities", "Credit & Funding", "Crypto",
];

export type FinancialMarketRow = {
  key: string;
  name: string;
  status: FinancialCoverage;
  value: number | null;
  unit: Unit;
  cadence: string;
  sourceId: string;
  observedAt: string | null;
  retrievedAt: string | null;
  quality: Observation["quality"] | null;
  change: number | null;
  changeUnit: ChangeUnit;
  predecessorAt: string | null;
  note: string | null;
};

export type FinancialMarketGroup = {
  name: FinancialDomain;
  coverage: FinancialCoverage;
  available: number;
  total: number;
  items: FinancialMarketRow[];
};

export type FinancialMarketPair = {
  target: string;
  companion: string;
  horizonMinutes: 60 | 120;
  direction: "SEARAH" | "BERLAWANAN" | "DATAR";
  targetChange: number;
  companionChange: number;
  targetStartAt: string;
  targetEndAt: string;
  companionStartAt: string;
  companionEndAt: string;
  sourceId: string;
};

export type FinancialMarketOverview = {
  asOf: string;
  groups: FinancialMarketGroup[];
  pairs: FinancialMarketPair[];
  comparisonNote: string;
  causalAttribution: "NOT_EVALUATED";
};

function instant(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function number(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function keyOf(item: Observation): string {
  return item.identity?.seriesKey || String(item.metadata?.seriesId || item.subject);
}

function eligible(item: Observation, def: Definition, asOfMs: number): boolean {
  if (def.sourceId === "" || keyOf(item) !== def.key || item.sourceId !== def.sourceId) return false;
  const observed = instant(item.observedAt);
  const retrieved = instant(item.retrievedAt);
  const value = number(item.value);
  if (observed === null || retrieved === null || observed > asOfMs || retrieved > asOfMs || value === null) return false;
  if ((def.unit === "USD" || def.unit === "USD_PER_BARREL" || def.unit === "INDEX" ||
       def.unit === "JPY_PER_USD" || def.unit === "CNH_PER_USD") && value <= 0) return false;
  if (def.unit === "PERCENT" && def.key === "crypto.btc_dominance.pct" && (value < 0 || value > 100)) return false;
  return true;
}

function predecessor(
  def: Definition,
  item: Observation,
  baselines: BaselinePresentation[],
  unified: UnifiedMacroPoint[],
): { change: number; at: string } | null {
  if (def.changeUnit === "UNAVAILABLE") return null;
  if (def.key === "DGS2" || def.key === "DFII10" || def.key === "dxy.index.usd") {
    const point = unified.find((entry) => entry.seriesKey === def.key);
    if (!point?.latest || !point.previous || point.change === null ||
        point.latest.observationId !== item.id || point.latest.sourceId !== item.sourceId ||
        !Number.isFinite(point.change) ||
        instant(point.previous.observedAt) === null ||
        instant(point.previous.observedAt)! >= instant(item.observedAt)!) return null;
    return { change: point.change, at: point.previous.observedAt };
  }
  const baseline = baselines.find((entry) => entry.seriesId === def.key);
  if (!baseline || baseline.status !== "VALID" || baseline.sourceId !== item.sourceId ||
      !baseline.baselineObservedAt || baseline.currentObservedAt.slice(0, 10) !== item.observedAt.slice(0, 10) ||
      baseline.baselineObservedAt.slice(0, 10) >= item.observedAt.slice(0, 10) ||
      baseline.changeValue === null || !Number.isFinite(baseline.changeValue) ||
      number(baseline.currentValue) !== number(item.value)) return null;
  const multiplier = def.changeUnit === "BPS" ? 100 : 1;
  return { change: baseline.changeValue * multiplier, at: baseline.baselineObservedAt };
}

/** Compare only the pre-qualified point-in-time MOVE fingerprint, never daily FRED rows. */
function synchronousPairs(monitor: MaterialMoveMonitorReadModel, asOfMs: number): FinancialMarketPair[] {
  if (monitor.causalAttribution !== "NOT_EVALUATED") return [];
  const result: FinancialMarketPair[] = [];
  const seen = new Set<string>();
  for (const asset of monitor.assets) {
    if (!asset.hasMaterialMove || !asset.evidence) continue;
    for (const horizon of asset.horizons) {
      if (horizon.horizonMinutes !== 60 && horizon.horizonMinutes !== 120) continue;
      if ((horizon.status !== "MATERIAL_MOVE" && horizon.status !== "BELOW_MATERIALITY_THRESHOLD") ||
          horizon.signedPercentChange === null || !Number.isFinite(horizon.signedPercentChange) ||
          !horizon.targetStartObservedAt || !horizon.targetEndObservedAt) continue;
      const start = instant(horizon.targetStartObservedAt);
      const end = instant(horizon.targetEndObservedAt);
      if (start === null || end === null || end <= start || end > asOfMs) continue;
      const fingerprint = asset.evidence.synchronousFingerprint.find((part) => part.horizonMinutes === horizon.horizonMinutes);
      if (!fingerprint) continue;
      for (const series of fingerprint.series) {
        if (series.state !== "AVAILABLE_SYNCHRONOUS" || series.signedPercentChange === null ||
            !Number.isFinite(series.signedPercentChange) || !series.start || !series.end) continue;
        if (!["btc.spot.usd", "eth.spot.usd", "gold.futures.usd", "dxy.index.usd",
              "fx.usdjpy.jpy_per_usd", "fx.usdcnh.cnh_per_usd"].includes(series.seriesKey)) continue;
        if (asset.seriesKey === series.seriesKey) continue;
        const ss = instant(series.start.observedAt);
        const se = instant(series.end.observedAt);
        const sr = instant(series.start.retrievedAt);
        const er = instant(series.end.retrievedAt);
        if (ss === null || se === null || sr === null || er === null ||
            Math.abs(ss - start) > 120_000 || Math.abs(se - end) > 120_000 ||
            se <= ss || sr > asOfMs || er > asOfMs) continue;
        const id = [asset.seriesKey, series.seriesKey, horizon.horizonMinutes].join(":");
        if (seen.has(id)) continue;
        seen.add(id);
        const targetSign = Math.sign(horizon.signedPercentChange);
        const otherSign = Math.sign(series.signedPercentChange);
        result.push({
          target: asset.seriesKey,
          companion: series.seriesKey,
          horizonMinutes: horizon.horizonMinutes,
          direction: !targetSign || !otherSign ? "DATAR" : targetSign === otherSign ? "SEARAH" : "BERLAWANAN",
          targetChange: horizon.signedPercentChange,
          companionChange: series.signedPercentChange,
          targetStartAt: horizon.targetStartObservedAt,
          targetEndAt: horizon.targetEndObservedAt,
          companionStartAt: series.start.observedAt,
          companionEndAt: series.end.observedAt,
          sourceId: series.sourceId,
        });
      }
    }
  }
  return result.slice(0, 8);
}

export function buildFinancialMarketOverview(input: {
  asOf: string;
  observations: Observation[];
  baselines: BaselinePresentation[];
  unifiedMacro?: UnifiedMacroPoint[];
  materialMove: MaterialMoveMonitorReadModel;
}): FinancialMarketOverview {
  const asOfMs = instant(input.asOf);
  if (asOfMs === null) throw new Error("FMKT-001 requires a valid as-of timestamp");
  const unified = input.unifiedMacro ?? [];
  const items = DEFINITIONS.map((def): FinancialMarketRow => {
    const latest = input.observations.filter((o) => eligible(o, def, asOfMs))
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) ||
        Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt))[0];
    if (!latest) return {
      key: def.key, name: def.name, status: "BELUM TERSEDIA", value: null,
      unit: def.unit, sourceId: def.sourceId, cadence: def.cadence,
      observedAt: null, retrievedAt: null, quality: null, change: null,
      changeUnit: def.changeUnit, predecessorAt: null,
      note: def.note ?? "Belum ada observasi canonical qualified pada cutoff ini",
    };
    const preceding = predecessor(def, latest, input.baselines, unified);
    return {
      key: def.key, name: def.name, status: latest.quality === "FRESH" ? "TERSEDIA" : "SEBAGIAN",
      value: number(latest.value), unit: def.unit, sourceId: latest.sourceId,
      cadence: def.cadence, observedAt: latest.observedAt, retrievedAt: latest.retrievedAt,
      quality: latest.quality, change: preceding?.change ?? null, changeUnit: def.changeUnit,
      predecessorAt: preceding?.at ?? null,
      note: preceding ? def.note ?? null : def.note
        ? def.note + " · perubahan: belum cukup data"
        : "Perubahan: belum cukup predecessor yang sebanding",
    };
  });
  const groups = DOMAINS.map((name): FinancialMarketGroup => {
    const rows = items.filter((row) => DEFINITIONS.some((d) => d.key === row.key && d.domain === name));
    const available = rows.filter((row) => row.status !== "BELUM TERSEDIA").length;
    return {
      name, items: rows, available, total: rows.length,
      coverage: available === 0 ? "BELUM TERSEDIA"
        : rows.every((row) => row.status === "TERSEDIA") ? "TERSEDIA" : "SEBAGIAN",
    };
  });
  const pairs = synchronousPairs(input.materialMove, asOfMs);
  return {
    asOf: input.asOf,
    groups, pairs,
    comparisonNote: pairs.length === 0
      ? "Belum dapat dibandingkan: tidak ada fingerprint MOVE 60/120 menit yang lolos sinkronisasi pada cutoff ini."
      : "Perbandingan hanya menggunakan fingerprint MOVE dengan pasangan timestamp ±120 detik; bukan bukti penyebab.",
    causalAttribution: "NOT_EVALUATED",
  };
}

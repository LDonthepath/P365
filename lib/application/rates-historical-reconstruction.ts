import { fetchMassiveMinuteBars, fetchMassiveZtContracts, type MassiveFuturesBar } from "../data/massive-futures";

const OFFSETS = { PRE: -5, T_PLUS_5: 5, T_PLUS_15: 15, T_PLUS_30: 30, T_PLUS_60: 60 } as const;
export type RatesReconstructionRole = keyof typeof OFFSETS;

export type RatesReconstructionPoint = {
  role: RatesReconstructionRole;
  targetAt: string;
  observedAt: string | null;
  price: number | null;
  distanceSeconds: number | null;
};

export type RatesReconstructionResult =
  | { status: "OK"; eventAt: string; instrument: "2-Year Treasury Note futures"; productCode: "ZT"; ticker: string; points: RatesReconstructionPoint[] }
  | { status: "UNAVAILABLE" | "ERROR"; reason: string };

function nearestBar(bars: MassiveFuturesBar[], targetMs: number): MassiveFuturesBar | null {
  let best: MassiveFuturesBar | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const bar of bars) {
    const distance = Math.abs(Date.parse(bar.windowStart) - targetMs);
    if (distance < bestDistance) {
      best = bar;
      bestDistance = distance;
    }
  }
  return bestDistance <= 60_000 ? best : null;
}

/**
 * Research-only historical reconstruction of ZT futures price around an event.
 * This does not represent the US 2Y cash yield and does not persist canonical evidence.
 */
export async function reconstructHistoricalZtEvent(eventAt: string): Promise<RatesReconstructionResult> {
  const eventMs = Date.parse(eventAt);
  if (!Number.isFinite(eventMs)) return { status: "ERROR", reason: "eventAt must be a valid ISO timestamp" };

  const date = new Date(eventMs).toISOString().slice(0, 10);
  const contracts = await fetchMassiveZtContracts(date);
  if (contracts.status !== "SUCCESS" || !contracts.data.length) {
    return { status: contracts.status === "ERROR" ? "ERROR" : "UNAVAILABLE", reason: contracts.message ?? "No active ZT contract found" };
  }

  // Research policy: choose the nearest-maturity active single ZT contract
  // that has observable 1-minute bars in the event window. "Active" alone does
  // not establish that a listed contract is trading during the sampled window.
  const from = new Date(eventMs - 7 * 60_000).toISOString();
  const to = new Date(eventMs + 62 * 60_000).toISOString();
  let contract = null;
  let bars = null;

  for (const candidate of contracts.data) {
    const candidateBars = await fetchMassiveMinuteBars({ ticker: candidate.ticker, from, to });
    if (candidateBars.status === "ERROR") {
      return { status: "ERROR", reason: candidateBars.message ?? "Massive minute-bar request failed" };
    }
    if (candidateBars.status === "SUCCESS" && candidateBars.data.length) {
      contract = candidate;
      bars = candidateBars;
      break;
    }
  }

  if (!contract || !bars) {
    return { status: "UNAVAILABLE", reason: "No active ZT contract has 1-minute bars in the event window" };
  }

  const points = (Object.entries(OFFSETS) as Array<[RatesReconstructionRole, number]>).map(([role, minutes]) => {
    const targetMs = eventMs + minutes * 60_000;
    const bar = nearestBar(bars.data, targetMs);
    return {
      role,
      targetAt: new Date(targetMs).toISOString(),
      observedAt: bar?.windowStart ?? null,
      price: bar?.close ?? null,
      distanceSeconds: bar ? Math.abs(Date.parse(bar.windowStart) - targetMs) / 1000 : null,
    };
  });

  return {
    status: "OK",
    eventAt: new Date(eventMs).toISOString(),
    instrument: "2-Year Treasury Note futures",
    productCode: "ZT",
    ticker: contract.ticker,
    points,
  };
}

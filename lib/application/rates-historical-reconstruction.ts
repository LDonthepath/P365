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

  // Explicit research policy: nearest-maturity active single ZT contract.
  // The selected ticker is returned so roll-period samples remain auditable.
  const contract = contracts.data[0];
  const from = new Date(eventMs - 7 * 60_000).toISOString();
  const to = new Date(eventMs + 62 * 60_000).toISOString();
  const bars = await fetchMassiveMinuteBars({ ticker: contract.ticker, from, to });
  if (bars.status !== "SUCCESS" || !bars.data.length) {
    return { status: bars.status === "ERROR" ? "ERROR" : "UNAVAILABLE", reason: bars.message ?? "No 1-minute ZT bars available" };
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

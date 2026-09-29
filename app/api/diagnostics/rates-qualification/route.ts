import { fetchMassiveMinuteBars, fetchMassiveZtContracts } from "../../../../lib/data/massive-futures";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const EVENT_AT = "2026-09-24T12:30:00.000Z";
const MAX_CANDIDATES = 8;

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ status: "DISABLED" }, { status: 404 });
  }

  const eventMs = Date.parse(EVENT_AT);
  const date = EVENT_AT.slice(0, 10);
  const contracts = await fetchMassiveZtContracts(date);
  if (contracts.status !== "SUCCESS") {
    return Response.json({
      status: contracts.status,
      stage: "CONTRACT_DISCOVERY",
      reason: contracts.message ?? "No active ZT contracts",
    });
  }

  const from = new Date(eventMs - 7 * 60_000).toISOString();
  const to = new Date(eventMs + 62 * 60_000).toISOString();
  const candidates = [];

  for (const contract of contracts.data.slice(0, MAX_CANDIDATES)) {
    const bars = await fetchMassiveMinuteBars({ ticker: contract.ticker, from, to });
    candidates.push({
      ticker: contract.ticker,
      daysToMaturity: contract.daysToMaturity,
      lastTradeDate: contract.lastTradeDate,
      settlementDate: contract.settlementDate,
      tradingVenue: contract.tradingVenue,
      barStatus: bars.status,
      barCount: bars.data.length,
      firstBarAt: bars.data[0]?.windowStart ?? null,
      lastBarAt: bars.data.at(-1)?.windowStart ?? null,
      reason: bars.message ?? null,
    });
  }

  return Response.json({
    status: "OK",
    eventAt: EVENT_AT,
    contractCount: contracts.data.length,
    candidates,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

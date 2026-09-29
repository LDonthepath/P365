import { fetchMassiveMinuteBars, fetchMassiveZtContracts } from "../../../../lib/data/massive-futures";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ status: "DISABLED" }, { status: 404 });
  }

  const eventAt = "2026-09-24T12:30:00.000Z";
  const date = eventAt.slice(0, 10);
  const contracts = await fetchMassiveZtContracts(date);
  if (contracts.status !== "SUCCESS" || !contracts.data.length) {
    return Response.json({
      status: "FAIL",
      stage: "CONTRACT_DISCOVERY",
      providerStatus: contracts.status,
      message: contracts.message ?? null,
    });
  }

  const contract = contracts.data[0];
  const eventMs = Date.parse(eventAt);
  const bars = await fetchMassiveMinuteBars({
    ticker: contract.ticker,
    from: new Date(eventMs - 7 * 60_000).toISOString(),
    to: new Date(eventMs + 62 * 60_000).toISOString(),
  });

  return Response.json({
    status: bars.status === "SUCCESS" && bars.data.length > 0 ? "PASS" : "FAIL",
    stage: "ONE_MINUTE_BARS",
    providerStatus: bars.status,
    productCode: contract.productCode,
    ticker: contract.ticker,
    lastTradeDate: contract.lastTradeDate,
    barCount: bars.data.length,
    firstBarAt: bars.data[0]?.windowStart ?? null,
    lastBarAt: bars.data.at(-1)?.windowStart ?? null,
    message: bars.message ?? null,
  });
}

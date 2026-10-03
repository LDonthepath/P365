import { buildBinanceBtcSpotFlowWindow, summarizeBybitRecentBtcSpotTrades } from "../../../../lib/application/btc-spot-flow";
import { fetchBinanceBtcSpotKlines } from "../../../../lib/data/binance-spot-flow";
import { fetchBybitRecentBtcSpotTrades } from "../../../../lib/data/bybit-spot-flow";

export const runtime = "nodejs";
export const maxDuration = 20;
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const [binance, bybit] = await Promise.all([
    fetchBinanceBtcSpotKlines({ limit: 3, acquisitionMode: "FRESH" }),
    fetchBybitRecentBtcSpotTrades({ limit: 60, acquisitionMode: "FRESH" }),
  ]);

  const latestBinance = binance.status === "SUCCESS" ? binance.data.at(-1) ?? null : null;
  const binanceFlow = latestBinance ? buildBinanceBtcSpotFlowWindow(latestBinance) : null;
  const bybitSample = bybit.status === "SUCCESS" ? summarizeBybitRecentBtcSpotTrades(bybit.data) : null;

  return Response.json(
    {
      writesPerformed: false,
      binance: {
        status: binance.status,
        retrievedAt: binance.retrievedAt,
        message: binance.message ?? null,
        barCount: binance.data.length,
        latestFlow: binanceFlow,
      },
      bybit: {
        status: bybit.status,
        retrievedAt: bybit.retrievedAt,
        message: bybit.message ?? null,
        tradeCount: bybit.data.length,
        recentSample: bybitSample,
      },
    },
    {
      status: binance.status === "ERROR" ? 502 : 200,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    },
  );
}

import { buildBinanceBtcOrderBookLiquiditySnapshot } from "../../../../lib/application/btc-order-book-liquidity";
import { fetchBinanceBtcOrderBook } from "../../../../lib/data/binance-order-book";

export const runtime = "nodejs";
export const maxDuration = 20;
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const result = await fetchBinanceBtcOrderBook({ limit: 500, acquisitionMode: "FRESH" });
  const snapshot = result.status === "SUCCESS" ? result.data[0] ?? null : null;
  const liquidity = snapshot
    ? buildBinanceBtcOrderBookLiquiditySnapshot({
        snapshot,
        retrievedAt: result.retrievedAt,
      })
    : null;

  return Response.json(
    {
      writesPerformed: false,
      provider: {
        status: result.status,
        retrievedAt: result.retrievedAt,
        message: result.message ?? null,
        levelCountBid: snapshot?.bids.length ?? 0,
        levelCountAsk: snapshot?.asks.length ?? 0,
        lastUpdateId: snapshot?.lastUpdateId ?? null,
      },
      liquidity,
    },
    {
      status: result.status === "ERROR" ? 502 : 200,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    },
  );
}

import {
  buildBinanceFuturesBtcPerpLiquiditySnapshot,
  buildHyperliquidBtcPerpLiquiditySnapshot,
} from "../../../../lib/application/btc-perp-order-book-liquidity";
import { fetchBinanceBtcUsdtPerpOrderBook } from "../../../../lib/data/binance-futures-order-book";
import { fetchHyperliquidBtcPerpOrderBook } from "../../../../lib/data/hyperliquid-perp-order-book";

export const runtime = "nodejs";
export const maxDuration = 20;
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const [hyperliquid, binance] = await Promise.all([
    fetchHyperliquidBtcPerpOrderBook({ acquisitionMode: "FRESH" }),
    fetchBinanceBtcUsdtPerpOrderBook({ limit: 500, acquisitionMode: "FRESH" }),
  ]);

  const hyperSnapshot = hyperliquid.status === "SUCCESS" ? hyperliquid.data[0] ?? null : null;
  const binanceSnapshot = binance.status === "SUCCESS" ? binance.data[0] ?? null : null;

  return Response.json(
    {
      writesPerformed: false,
      hyperliquid: {
        status: hyperliquid.status,
        retrievedAt: hyperliquid.retrievedAt,
        message: hyperliquid.message ?? null,
        liquidity: hyperSnapshot
          ? buildHyperliquidBtcPerpLiquiditySnapshot({
              snapshot: hyperSnapshot,
              retrievedAt: hyperliquid.retrievedAt,
            })
          : null,
      },
      binanceFutures: {
        status: binance.status,
        retrievedAt: binance.retrievedAt,
        message: binance.message ?? null,
        liquidity: binanceSnapshot
          ? buildBinanceFuturesBtcPerpLiquiditySnapshot({
              snapshot: binanceSnapshot,
              retrievedAt: binance.retrievedAt,
            })
          : null,
      },
    },
    {
      status: hyperliquid.status === "ERROR" ? 502 : 200,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    },
  );
}

import { fetchUsdCnhSpot, fetchUsdJpySpot } from "../../../../lib/data/yahoo-finance-markets";
import { cryptoMarketToObservations, P365_SOURCES } from "../../../../lib/domain/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const [usdjpy, usdcnh] = await Promise.all([
    fetchUsdJpySpot("FRESH"),
    fetchUsdCnhSpot("FRESH"),
  ]);

  const normalized = [usdjpy, usdcnh].map((result) => result.status === "SUCCESS"
    ? cryptoMarketToObservations(result.data, P365_SOURCES.yahooFinance.id).observations.map((item) => ({
        seriesKey: item.identity?.seriesKey ?? null,
        quality: item.quality,
        observedAt: item.observedAt,
        retrievedAt: item.retrievedAt,
      }))
    : []);

  return Response.json({
    evaluatedAt: new Date().toISOString(),
    writesPerformed: false,
    usdjpy,
    usdcnh,
    canonicalQuality: { usdjpy: normalized[0], usdcnh: normalized[1] },
  }, {
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

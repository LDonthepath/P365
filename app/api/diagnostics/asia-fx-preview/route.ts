import { fetchUsdCnhSpot, fetchUsdJpySpot } from "../../../../lib/data/yahoo-finance-markets";

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

  return Response.json({
    evaluatedAt: new Date().toISOString(),
    writesPerformed: false,
    usdjpy,
    usdcnh,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

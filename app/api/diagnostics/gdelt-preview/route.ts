import { buildMoveNewsCatalystEvidence } from "../../../../lib/application/move-news-catalyst";
import { fetchGdeltGalCandidateSnapshot } from "../../../../lib/data/gdelt-gal";

export const runtime = "nodejs";
export const maxDuration = 25;
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const result = await fetchGdeltGalCandidateSnapshot({
    asset: "BTC",
    maxCandidates: 25,
    acquisitionMode: "FRESH",
  });
  const evidence = buildMoveNewsCatalystEvidence({ asset: "BTC", result });

  return Response.json(
    {
      writesPerformed: false,
      provider: {
        status: result.status,
        retrievedAt: result.retrievedAt,
        message: result.message ?? null,
      },
      evidence,
      totalFeedItems: result.data[0]?.totalFeedItems ?? null,
      invalidItemCount: result.data[0]?.invalidItemCount ?? null,
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

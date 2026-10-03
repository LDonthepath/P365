import { fetchGdeltMoveWindowArticles } from "../../../../lib/data/gdelt-doc";

export const runtime = "nodejs";
export const maxDuration = 25;
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const now = new Date();
  const endMs = now.getTime() - 60_000;
  const startMs = endMs - 60 * 60 * 1000;
  const startAt = new Date(startMs).toISOString();
  const endAt = new Date(endMs).toISOString();

  const btc = await fetchGdeltMoveWindowArticles({
    asset: "BTC",
    startAt,
    endAt,
    maxRecords: 10,
    acquisitionMode: "FRESH",
  });

  return Response.json(
    {
      writesPerformed: false,
      window: { startAt, endAt },
      btc: {
        status: btc.status,
        retrievedAt: btc.retrievedAt,
        message: btc.message ?? null,
        count: btc.data.length,
        sample: btc.data.slice(0, 5),
      },
    },
    {
      status: btc.status === "ERROR" ? 502 : 200,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    },
  );
}

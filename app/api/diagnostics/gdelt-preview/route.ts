import { fetchGdeltMoveWindowArticles, gdeltQueryForAsset } from "../../../../lib/data/gdelt-doc";

export const runtime = "nodejs";
export const maxDuration = 25;
export const dynamic = "force-dynamic";

function gdeltDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const now = new Date();
  const endMs = now.getTime() - 60_000;
  const startMs = endMs - 60 * 60 * 1000;
  const startAt = new Date(startMs).toISOString();
  const endAt = new Date(endMs).toISOString();

  const [btc, gold, timelineResponse] = await Promise.all([
    fetchGdeltMoveWindowArticles({
      asset: "BTC",
      startAt,
      endAt,
      maxRecords: 10,
      acquisitionMode: "FRESH",
    }),
    fetchGdeltMoveWindowArticles({
      asset: "GOLD",
      startAt,
      endAt,
      maxRecords: 10,
      acquisitionMode: "FRESH",
    }),
    (() => {
      const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      url.searchParams.set("query", gdeltQueryForAsset("BTC"));
      url.searchParams.set("mode", "timelinevolraw");
      url.searchParams.set("format", "json");
      url.searchParams.set("timelinesmooth", "0");
      url.searchParams.set("startdatetime", gdeltDate(startMs));
      url.searchParams.set("enddatetime", gdeltDate(endMs));
      return fetch(url.toString(), {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    })(),
  ]);

  let timelineShape: unknown = null;
  if (timelineResponse.ok) {
    const raw = await timelineResponse.json() as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const row = raw as Record<string, unknown>;
      timelineShape = {
        topLevelKeys: Object.keys(row).sort(),
        timelineType: Array.isArray(row.timeline) ? "array" : typeof row.timeline,
        timelineSample: Array.isArray(row.timeline) ? row.timeline.slice(0, 2) : row.timeline ?? null,
      };
    } else {
      timelineShape = { kind: Array.isArray(raw) ? "array" : typeof raw };
    }
  } else {
    timelineShape = { httpStatus: timelineResponse.status, body: (await timelineResponse.text()).slice(0, 240) };
  }

  return Response.json(
    {
      writesPerformed: false,
      window: { startAt, endAt },
      btc: {
        status: btc.status,
        retrievedAt: btc.retrievedAt,
        message: btc.message ?? null,
        count: btc.data.length,
        sample: btc.data.slice(0, 3),
      },
      gold: {
        status: gold.status,
        retrievedAt: gold.retrievedAt,
        message: gold.message ?? null,
        count: gold.data.length,
        sample: gold.data.slice(0, 3),
      },
      timelineShape,
    },
    {
      status: btc.status === "ERROR" || gold.status === "ERROR" ? 502 : 200,
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    },
  );
}

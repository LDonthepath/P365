export const runtime = "nodejs";
export const maxDuration = 15;
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const apiKey = process.env.COINALYZE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "COINALYZE_API_KEY is not configured" }, { status: 503 });
  }

  const response = await fetch("https://api.coinalyze.net/v1/future-markets", {
    headers: { accept: "application/json", api_key: apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return Response.json({ error: `Coinalyze HTTP ${response.status}` }, { status: 502 });
  }

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) {
    return Response.json({ error: "unexpected non-array payload" }, { status: 502 });
  }

  const sample = payload.slice(0, 5).map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return { kind: Array.isArray(candidate) ? "array" : typeof candidate };
    }
    const row = candidate as Record<string, unknown>;
    return {
      symbol: row.symbol ?? null,
      exchange: row.exchange ?? null,
      base_asset: row.base_asset ?? null,
      is_perpetual: row.is_perpetual ?? null,
      expire_at: row.expire_at ?? null,
      expire_at_type: row.expire_at === null ? "null" : typeof row.expire_at,
      margined: row.margined ?? null,
      oi_lq_vol_denominated_in: row.oi_lq_vol_denominated_in ?? null,
      keys: Object.keys(row).sort(),
    };
  });

  return Response.json(
    { count: payload.length, sample },
    {
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    },
  );
}

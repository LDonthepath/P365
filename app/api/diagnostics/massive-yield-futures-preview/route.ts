export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;

async function massive(path: string, apiKey: string): Promise<Json> {
  const url = new URL(`https://api.massive.com${path}`);
  url.searchParams.set("apiKey", apiKey);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const body = await response.json().catch(() => ({})) as Json;
  return { httpStatus: response.status, ok: response.ok, ...body };
}

async function probeProduct(productCode: "2YY" | "10Y", apiKey: string): Promise<Json> {
  const product = await massive(`/futures/v1/products?product_code=${productCode}&limit=10`, apiKey);
  const contracts = await massive(
    `/futures/v1/contracts?product_code=${productCode}&active=true&date=2026-10-02&limit=10&sort=ticker.asc`,
    apiKey,
  );

  const results = Array.isArray(contracts.results) ? contracts.results as Array<Record<string, unknown>> : [];
  const ranked = [...results].sort((a, b) => Number(a.days_to_maturity ?? Number.POSITIVE_INFINITY) - Number(b.days_to_maturity ?? Number.POSITIVE_INFINITY));
  const ticker = typeof ranked[0]?.ticker === "string" ? ranked[0].ticker : null;
  const bars = ticker
    ? await massive(`/futures/v1/aggs/${encodeURIComponent(ticker)}?resolution=5min&limit=6&sort=window_start.desc`, apiKey)
    : { status: "NO_CONTRACT_TICKER" };

  return { productCode, product, contracts, selectedTicker: ticker, bars };
}

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "MASSIVE_API_KEY missing", writesPerformed: false }, { status: 503 });
  }

  const [twoYear, tenYear] = await Promise.all([
    probeProduct("2YY", apiKey),
    probeProduct("10Y", apiKey),
  ]);

  return Response.json({
    evaluatedAt: new Date().toISOString(),
    writesPerformed: false,
    credentialSource: "existing-server-env",
    twoYear,
    tenYear,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

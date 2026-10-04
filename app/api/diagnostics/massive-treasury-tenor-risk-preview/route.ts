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

async function productCoverage(productCode: "ZN" | "TN", apiKey: string): Promise<Json> {
  const contracts = await massive(
    `/futures/v1/contracts?product_code=${productCode}&active=true&date=2026-10-02&type=single&limit=20&sort=ticker.asc`,
    apiKey,
  );
  const rows = Array.isArray(contracts.results) ? contracts.results as Array<Record<string, unknown>> : [];
  const coverage = await Promise.all(rows.map(async (contract) => {
    const ticker = typeof contract.ticker === "string" ? contract.ticker : null;
    if (!ticker) return { ticker: null, status: "NO_TICKER" };
    const bars = await massive(
      `/futures/v1/aggs/${encodeURIComponent(ticker)}?resolution=5min&window_start.gte=2026-10-01&window_start.lt=2026-10-03&limit=50000&sort=window_start.asc`,
      apiKey,
    );
    const data = Array.isArray(bars.results) ? bars.results as Array<Record<string, unknown>> : [];
    return {
      ticker,
      settlementDate: contract.settlement_date ?? null,
      daysToMaturity: contract.days_to_maturity ?? null,
      barCount: data.length,
      volume: data.reduce((sum, bar) => sum + (typeof bar.volume === "number" ? bar.volume : 0), 0),
      transactions: data.reduce((sum, bar) => sum + (typeof bar.transactions === "number" ? bar.transactions : 0), 0),
      httpStatus: bars.httpStatus ?? null,
      status: bars.status ?? null,
    };
  }));

  return {
    productCode,
    contractsStatus: contracts.status ?? null,
    coverage: coverage.sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0)),
  };
}

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }
  const apiKey = process.env.MASSIVE_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "MASSIVE_API_KEY missing", writesPerformed: false }, { status: 503 });
  }

  const [zn, tn] = await Promise.all([
    productCoverage("ZN", apiKey),
    productCoverage("TN", apiKey),
  ]);

  return Response.json({
    evaluatedAt: new Date().toISOString(),
    writesPerformed: false,
    purpose: "bounded-tenor-fidelity-risk-qualification",
    zn,
    tn,
  }, { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

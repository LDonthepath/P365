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

async function probeProduct(productCode: string, apiKey: string): Promise<Json> {
  const contracts = await massive(
    `/futures/v1/contracts?product_code=${productCode}&active=true&date=2026-10-02&limit=20&sort=ticker.asc`,
    apiKey,
  );

  const results = Array.isArray(contracts.results) ? contracts.results as Array<Record<string, unknown>> : [];
  const singles = results.filter((item) => item.type === "single" && typeof item.ticker === "string");

  const contractCoverage = await Promise.all(singles.map(async (contract) => {
    const ticker = String(contract.ticker);
    const session = await massive(
      `/futures/v1/aggs/${encodeURIComponent(ticker)}?resolution=5min&window_start.gte=2026-10-01&window_start.lt=2026-10-03&limit=50000&sort=window_start.asc`,
      apiKey,
    );
    const bars = Array.isArray(session.results) ? session.results as Array<Record<string, unknown>> : [];
    const starts = bars
      .map((bar) => typeof bar.window_start === "number" ? bar.window_start : null)
      .filter((value): value is number => value !== null);
    const gapsMinutes = starts.slice(1).map((value, index) => (value - starts[index]) / 60_000_000_000);
    return {
      ticker,
      daysToMaturity: contract.days_to_maturity ?? null,
      settlementDate: contract.settlement_date ?? null,
      httpStatus: session.httpStatus ?? null,
      status: session.status ?? null,
      barCount: bars.length,
      totalVolume: bars.reduce((sum, bar) => sum + (typeof bar.volume === "number" ? bar.volume : 0), 0),
      totalTransactions: bars.reduce((sum, bar) => sum + (typeof bar.transactions === "number" ? bar.transactions : 0), 0),
      firstWindowStart: starts[0] ?? null,
      lastWindowStart: starts.at(-1) ?? null,
      maxGapMinutes: gapsMinutes.length ? Math.max(...gapsMinutes) : null,
      gapsOver15m: gapsMinutes.filter((gap) => gap > 15).length,
      gapsOver30m: gapsMinutes.filter((gap) => gap > 30).length,
      gapsOver60m: gapsMinutes.filter((gap) => gap > 60).length,
    };
  }));

  const ranked = [...contractCoverage].sort((a, b) => Number(b.totalVolume) - Number(a.totalVolume));
  return {
    productCode,
    contracts,
    contractCoverage,
    mostLiquidObservedContract: ranked[0] ?? null,
  };
}

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "MASSIVE_API_KEY missing", writesPerformed: false }, { status: 503 });
  }

  const [twoYearNote, tenYearNote] = await Promise.all([
    probeProduct("ZT", apiKey),
    probeProduct("ZN", apiKey),
  ]);

  return Response.json({
    evaluatedAt: new Date().toISOString(),
    writesPerformed: false,
    credentialSource: "existing-server-env",
    probeMode: "standard-treasury-futures",
    twoYearNote,
    tenYearNote,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

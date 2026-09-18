import type { Observation } from "../domain/types";
import type { ObservationHistoryQuery } from "../repositories/types";
import { SupabaseHistoricalObservationRepository } from "./supabase-observation-history";

type StoredRow = { record_type: string; effective_at: string; captured_at: string; payload: unknown };

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertRejects(label: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(`${label}: expected promise to reject`);
}

function observation(
  id: string,
  domain: Observation["domain"],
  seriesKey: string,
  observedAt: string,
  retrievedAt: string,
  overrides: Partial<Observation> = {},
): Observation {
  const metadataKey = domain === "MACRO" ? "seriesId" : "metricId";
  return {
    id,
    domain,
    subject: `label-${id}`,
    value: id,
    observedAt,
    retrievedAt,
    sourceId: domain === "MACRO" ? "fred" : "coingecko-market",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: { [metadataKey]: seriesKey },
    ...overrides,
  };
}

function row(payload: unknown, recordType = "OBSERVATION", capturedAt = "2026-09-10T00:00:00.000Z"): StoredRow {
  const candidate = payload as Partial<Observation>;
  return {
    record_type: recordType,
    effective_at: candidate.observedAt ?? capturedAt,
    captured_at: capturedAt,
    payload,
  };
}

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\")
    : value;
}

function fakePostgrest(rows: StoredRow[]): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const params = url.searchParams;
    const semanticMatch = params.get("or")?.match(/seriesId\.eq\.([^,]+),payload->metadata->>metricId\.eq\.([^\)]+)/);
    const seriesKey = semanticMatch ? unquote(semanticMatch[1]) : "";
    const domain = params.get("payload->>domain")?.replace(/^eq\./, "");
    const sourceFilter = params.get("payload->>sourceId");
    const sourceId = sourceFilter?.replace(/^eq\./, "");
    const effectiveBounds = params.getAll("effective_at");
    const retrievedFilter = params.get("payload->>retrievedAt");
    const direction = params.get("order")?.includes(".desc") ? -1 : 1;
    const limit = Number(params.get("limit"));

    const result = rows.filter((stored) => {
      if (stored.record_type !== "OBSERVATION") return false;
      const payload = stored.payload as Partial<Observation>;
      if (payload.domain !== domain || !payload.id || !payload.observedAt || !payload.retrievedAt) return false;
      const metadata = payload.metadata ?? {};
      if (metadata.seriesId !== seriesKey && metadata.metricId !== seriesKey) return false;
      if (sourceFilter?.startsWith("eq.") && payload.sourceId !== unquote(sourceId ?? "")) return false;
      for (const bound of effectiveBounds) {
        const boundary = Date.parse(bound.slice(4));
        const effective = Date.parse(stored.effective_at);
        if (bound.startsWith("gte.") && effective < boundary) return false;
        if (bound.startsWith("lte.") && effective > boundary) return false;
      }
      if (retrievedFilter?.startsWith("lte.") && Date.parse(payload.retrievedAt) > Date.parse(retrievedFilter.slice(4))) return false;
      return true;
    }).sort((left, right) => {
      const a = left.payload as Observation;
      const b = right.payload as Observation;
      return direction * (
        Date.parse(a.observedAt) - Date.parse(b.observedAt)
        || Date.parse(a.retrievedAt) - Date.parse(b.retrievedAt)
        || a.id.localeCompare(b.id)
      );
    }).slice(0, limit).map(({ effective_at, payload }) => ({ effective_at, payload }));

    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

async function main(): Promise<void> {
  const rows: StoredRow[] = [
    row(observation("fred-old", "MACRO", "CPIAUCSL", "2026-06-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z")),
    row(observation("fred-original", "MACRO", "CPIAUCSL", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z")),
    row(observation("fred-correction", "MACRO", "CPIAUCSL", "2026-07-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z", {
      subject: "renamed subject",
      value: "corrected",
    }), "OBSERVATION", "2026-09-03T00:00:00.000Z"),
    row(observation("alternate-source", "MACRO", "CPIAUCSL", "2026-08-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z", {
      sourceId: "qualified-alternate",
      subject: "alternate label",
    })),
    row(observation("core-cpi", "MACRO", "CPILFESL", "2026-08-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z")),
    row(observation("btc", "ASSET", "btc.spot.usd", "2026-08-01T00:00:00.000Z", "2026-08-01T00:01:00.000Z")),
    row(observation("btc-other-source", "ASSET", "btc.spot.usd", "2026-08-02T00:00:00.000Z", "2026-08-02T00:01:00.000Z", {
      sourceId: "qualified-crypto-alternate",
    })),
    row(observation("eth", "ASSET", "eth.spot.usd", "2026-08-01T00:00:00.000Z", "2026-08-01T00:01:00.000Z")),
    row(observation("gold", "ASSET", "gold.futures.usd", "2026-08-01T00:00:00.000Z", "2026-08-01T00:01:00.000Z", {
      sourceId: "yahoo-finance",
      subject: "Gold futures renamed",
    })),
    row({ id: "legacy", domain: "MACRO", observedAt: "2026-05-01T00:00:00.000Z", metadata: { seriesId: "CPIAUCSL" } }),
    row(observation("not-observation", "MACRO", "CPIAUCSL", "2026-09-01T00:00:00.000Z", "2026-09-01T00:01:00.000Z"), "EVIDENCE"),
  ];
  const repository = new SupabaseHistoricalObservationRepository({
    fetch: fakePostgrest(rows),
    config: () => ({ url: "https://example.supabase.co", key: "server-only-test-key" }),
  });
  const query = (overrides: Partial<ObservationHistoryQuery> = {}): ObservationHistoryQuery => ({
    identity: { domain: "MACRO", seriesKey: "CPIAUCSL" }, order: "ASC", limit: 20, ...overrides,
  });

  assertEqual((await repository.findHistory(query())).map((item) => item.id),
    ["fred-old", "fred-original", "fred-correction", "alternate-source"],
    "FRED history retains subject/id/source changes and excludes malformed/non-Observation rows");
  assertEqual((await repository.findHistory(query({ sourceId: "fred" }))).map((item) => item.id),
    ["fred-old", "fred-original", "fred-correction"], "optional provenance filter");
  assertEqual((await repository.findHistory(query({
    observedAtOnOrAfter: "2026-07-01T00:00:00.000Z",
    observedAtOnOrBefore: "2026-07-01T00:00:00.000Z",
  }))).map((item) => item.id), ["fred-original", "fred-correction"], "inclusive effective bounds retain revisions");
  assertEqual((await repository.findHistory(query({ retrievedAtOnOrBefore: "2026-08-31T23:59:59.999Z" }))).map((item) => item.id),
    ["fred-old", "fred-original"], "retrieval cutoff excludes unavailable correction independent of captured_at");
  assertEqual((await repository.findHistory(query({ order: "DESC", limit: 2 }))).map((item) => item.id),
    ["alternate-source", "fred-correction"], "deterministic descending order and limit");
  assertEqual((await repository.findHistory({ identity: { domain: "ASSET", seriesKey: "btc.spot.usd" }, order: "ASC", limit: 20 })).map((item) => item.id),
    ["btc", "btc-other-source"], "CoinGecko semantic history across provenance");
  assertEqual((await repository.findHistory({ identity: { domain: "ASSET", seriesKey: "gold.futures.usd" }, order: "ASC", limit: 20 })).map((item) => item.id),
    ["gold"], "Yahoo semantic history");
  assertEqual(await repository.findHistory(query({ identity: { domain: "MACRO", seriesKey: "MISSING" } })), [], "missing history");
  assertEqual((await repository.findHistory(query({ identity: { domain: "MACRO", seriesKey: "CPILFESL" } }))).map((item) => item.id), ["core-cpi"], "series isolation");

  await assertRejects("empty series key", () => repository.findHistory(query({ identity: { domain: "MACRO", seriesKey: " " } })));
  await assertRejects("invalid domain", () => repository.findHistory(query({ identity: { domain: "INVALID" as "MACRO", seriesKey: "CPIAUCSL" } })));
  await assertRejects("empty source", () => repository.findHistory(query({ sourceId: " " })));
  await assertRejects("invalid order", () => repository.findHistory(query({ order: "SIDEWAYS" as "ASC" })));
  await assertRejects("invalid limit", () => repository.findHistory(query({ limit: 0 })));
  await assertRejects("invalid cutoff", () => repository.findHistory(query({ retrievedAtOnOrBefore: "invalid" })));
}

void main();

import type { Observation } from "../domain/types";
import type { ObservationHistoryQuery } from "../repositories/types";
import { SupabaseHistoricalObservationRepository } from "./supabase-observation-history";

type StoredRow = { id: string; record_type: string; effective_at: string; captured_at: string; payload: unknown };

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
    id: `row-${candidate.id ?? "malformed"}`,
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
    const direction = params.get("order")?.includes(".desc") ? -1 : 1;
    const limit = Number(params.get("limit"));
    const offset = Number(params.get("offset"));

    const result = rows.filter((stored) => {
      if (stored.record_type !== "OBSERVATION") return false;
      const payload = stored.payload as Partial<Observation>;
      if (payload.domain !== domain) return false;
      const metadata = payload.metadata ?? {};
      if (metadata.seriesId !== seriesKey && metadata.metricId !== seriesKey) return false;
      if (sourceFilter?.startsWith("eq.") && payload.sourceId !== unquote(sourceId ?? "")) return false;
      for (const bound of effectiveBounds) {
        const boundary = Date.parse(bound.slice(4));
        const effective = Date.parse(stored.effective_at);
        if (bound.startsWith("gte.") && effective < boundary) return false;
        if (bound.startsWith("lte.") && effective > boundary) return false;
      }
      return true;
    }).sort((left, right) => {
      return direction * (
        Date.parse(left.effective_at) - Date.parse(right.effective_at)
        || left.id.localeCompare(right.id)
      );
    }).slice(offset, offset + limit).map(({ id, effective_at, payload }) => ({ id, effective_at, payload }));

    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

async function main(): Promise<void> {
  const rows: StoredRow[] = [
    row(observation("fred-old", "MACRO", "CPIAUCSL", "2026-06-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z")),
    row(observation("fred-original", "MACRO", "CPIAUCSL", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", {
      quality: "STALE",
    })),
    row(observation("fred-correction", "MACRO", "CPIAUCSL", "2026-07-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z", {
      subject: "renamed subject",
      value: "corrected",
      identity: {
        version: "v1",
        seriesKey: "CPIAUCSL",
        measurementId: "measurement-v1-test",
        revisionFingerprint: "a".repeat(64),
      },
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
    row(observation("offset-earlier", "OTHER", "offset-order", "2026-08-01T00:00:00.000Z", "2026-09-01T00:30:00+01:00")),
    row(observation("tie-a", "OTHER", "offset-order", "2026-07-31T20:00:00-04:00", "2026-08-31T23:45:00Z")),
    row(observation("tie-z", "OTHER", "offset-order", "2026-08-01T09:00:00+09:00", "2026-09-01T00:45:00+01:00")),
    row(observation("not-observation", "MACRO", "CPIAUCSL", "2026-09-01T00:00:00.000Z", "2026-09-01T00:01:00.000Z"), "EVIDENCE"),
  ];
  const requests: string[] = [];
  const fakeFetch = fakePostgrest(rows);
  const repository = new SupabaseHistoricalObservationRepository({
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push(String(input));
      return fakeFetch(input, init);
    }) as typeof fetch,
    config: () => ({ url: "https://example.supabase.co", key: "server-only-test-key" }),
    candidateBatchSize: 2,
    maxCandidateScan: 50,
  });
  const query = (overrides: Partial<ObservationHistoryQuery> = {}): ObservationHistoryQuery => ({
    identity: { domain: "MACRO", seriesKey: "CPIAUCSL" }, order: "ASC", limit: 20, ...overrides,
  });

  assertEqual((await repository.findHistory(query())).map((item) => item.id),
    ["fred-old", "fred-original", "fred-correction", "alternate-source"],
    "FRED history retains subject/id/source changes and excludes malformed/non-Observation rows");
  assertEqual((await repository.findHistory(query({ sourceId: "fred" }))).map((item) => item.id),
    ["fred-old", "fred-original", "fred-correction"], "optional provenance filter");
  const sourceQuery = new URL(requests.at(-1)!).searchParams;
  assertEqual(sourceQuery.get("payload->>sourceId"), "eq.fred", "sourceId uses raw PostgREST equality value");
  assertEqual(
    sourceQuery.get("or"),
    "(payload->metadata->>seriesId.eq.CPIAUCSL,payload->metadata->>metricId.eq.CPIAUCSL)",
    "semantic series filter uses raw PostgREST equality values",
  );
  assertEqual((await repository.findHistory(query({ sourceId: "fred" })))[2]?.identity?.version,
    "v1", "versioned and legacy Observation payloads remain readable together");
  assertEqual((await repository.findHistory(query({ sourceId: "fred" })))[1]?.quality,
    "STALE", "durable adapter returns stored predecessor quality without mutation or filtering");
  assertEqual((await repository.findHistory(query({
    observedAtOnOrAfter: "2026-07-01T00:00:00.000Z",
    observedAtOnOrBefore: "2026-07-01T00:00:00.000Z",
  }))).map((item) => item.id), ["fred-original", "fred-correction"], "inclusive effective bounds retain revisions");
  assertEqual((await repository.findHistory(query({ retrievedAtOnOrBefore: "2026-08-31T23:59:59.999Z" }))).map((item) => item.id),
    ["fred-old", "fred-original"], "retrieval cutoff excludes unavailable correction independent of captured_at");
  assertEqual((await repository.findHistory(query({ order: "DESC", limit: 2 }))).map((item) => item.id),
    ["alternate-source", "fred-correction"], "deterministic descending order and limit");
  assertEqual((await repository.findHistory(query({ limit: 2 }))).map((item) => item.id),
    ["fred-old", "fred-original"], "malformed pre-limit candidate does not hide later valid history");
  assertEqual((await repository.findHistory({ identity: { domain: "ASSET", seriesKey: "btc.spot.usd" }, order: "ASC", limit: 20 })).map((item) => item.id),
    ["btc", "btc-other-source"], "CoinGecko semantic history across provenance");
  assertEqual((await repository.findHistory({ identity: { domain: "ASSET", seriesKey: "gold.futures.usd" }, order: "ASC", limit: 20 })).map((item) => item.id),
    ["gold"], "Yahoo semantic history");
  assertEqual(await repository.findHistory(query({ identity: { domain: "MACRO", seriesKey: "MISSING" } })), [], "missing history");
  assertEqual((await repository.findHistory(query({ identity: { domain: "MACRO", seriesKey: "CPILFESL" } }))).map((item) => item.id), ["core-cpi"], "series isolation");
  const offsetIdentity = { domain: "OTHER" as const, seriesKey: "offset-order" };
  assertEqual((await repository.findHistory({ identity: offsetIdentity, order: "ASC", limit: 3 })).map((item) => item.id),
    ["offset-earlier", "tie-a", "tie-z"], "ASC uses timestamp instants then id, not lexical timestamp text");
  assertEqual((await repository.findHistory({ identity: offsetIdentity, order: "DESC", limit: 3 })).map((item) => item.id),
    ["tie-z", "tie-a", "offset-earlier"], "DESC reverses instant and id tie ordering deterministically");

  const boundedRepository = new SupabaseHistoricalObservationRepository({
    fetch: fakePostgrest(rows),
    config: () => ({ url: "https://example.supabase.co", key: "server-only-test-key" }),
    candidateBatchSize: 1,
    maxCandidateScan: 1,
  });
  await assertRejects("bounded candidate scan fails rather than returning an unproven result", () => boundedRepository.findHistory(query({ limit: 1 })));

  await assertRejects("empty series key", () => repository.findHistory(query({ identity: { domain: "MACRO", seriesKey: " " } })));
  await assertRejects("invalid domain", () => repository.findHistory(query({ identity: { domain: "INVALID" as "MACRO", seriesKey: "CPIAUCSL" } })));
  await assertRejects("empty source", () => repository.findHistory(query({ sourceId: " " })));
  await assertRejects("invalid order", () => repository.findHistory(query({ order: "SIDEWAYS" as "ASC" })));
  await assertRejects("invalid limit", () => repository.findHistory(query({ limit: 0 })));
  await assertRejects("invalid cutoff", () => repository.findHistory(query({ retrievedAtOnOrBefore: "invalid" })));
}

void main();

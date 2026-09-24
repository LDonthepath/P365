import type { MarketSnapshot } from "../domain/market-snapshot";
import { SupabaseHistoricalMarketSnapshotRepository } from "./supabase-snapshot-history";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label
      + ": expected "
      + JSON.stringify(expected)
      + ", got "
      + JSON.stringify(actual),
    );
  }
}

function snapshot(
  id: string,
  capturedAt: string,
  scope = "MVP_MACRO_CRYPTO_GOLD_EVENT",
  eventIdentityKey = "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
): MarketSnapshot {
  return {
    id,
    version: "v1",
    capturedAt,
    scope,
    observationRefs: [],
    eventRefs: [],
    baselineRefs: [],
    stateRefs: [],
    sourceHealthRefs: [],
    requirements: [{ kind: "OBSERVATION", key: "ASSET:btc.spot.usd:coingecko-market" }],
    missingRequirements: [{ kind: "OBSERVATION", key: "ASSET:btc.spot.usd:coingecko-market" }],
    quality: "PARTIAL",
    metadata: { eventIdentityKey },
  };
}

async function main(): Promise<void> {
  const rows = [
    {
      id: "row-late",
      effective_at: "2026-10-15T12:31:00.000Z",
      payload: snapshot("snapshot-late", "2026-10-15T12:31:00.000Z"),
    },
    {
      id: "row-early",
      effective_at: "2026-10-15T12:29:00.000Z",
      payload: snapshot("snapshot-early", "2026-10-15T12:29:00.000Z"),
    },
  ];
  const urls: string[] = [];

  const repository = new SupabaseHistoricalMarketSnapshotRepository({
    config: () => ({
      url: "https://example.supabase.co",
      key: "server-key",
    }),
    candidateBatchSize: 10,
    maxCandidateScan: 20,
    fetch: (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify(rows),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch,
  });

  const history = await repository.findHistory({
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    eventIdentityKey: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
    capturedAtOnOrBefore: "2026-10-15T12:30:00.000Z",
    order: "DESC",
    limit: 10,
  });

  assertEqual(
    history.map((item) => item.id),
    ["snapshot-early"],
    "canonical capturedAt bound excludes later snapshot even if transport returns it",
  );

  const query = new URL(urls[0]).searchParams;
  assertEqual(query.get("record_type"), "eq.SNAPSHOT", "adapter scopes SNAPSHOT rows");
  assertEqual(
    query.get("payload->>scope"),
    "eq.MVP_MACRO_CRYPTO_GOLD_EVENT",
    "adapter scopes Snapshot reasoning scope with raw equality value",
  );
  assertEqual(
    query.get("payload->metadata->>eventIdentityKey"),
    "eq.event:v1:US:2026-10-15T12:30:00.000Z:cpi",
    "adapter scopes requested event identity with raw equality value",
  );
  assertEqual(
    query.getAll("effective_at"),
    ["lte.2026-10-15T12:30:00.000Z"],
    "adapter pushes capturedAt bound to effective_at",
  );

  const mismatch = new SupabaseHistoricalMarketSnapshotRepository({
    config: () => ({
      url: "https://example.supabase.co",
      key: "server-key",
    }),
    fetch: (async () => new Response(
      JSON.stringify([
        {
          id: "wrong-scope",
          effective_at: "2026-10-15T12:29:00.000Z",
          payload: snapshot(
            "wrong-scope",
            "2026-10-15T12:29:00.000Z",
            "OTHER_SCOPE",
          ),
        },
      ]),
      { status: 200 },
    )) as typeof fetch,
  });

  let rejected = false;
  try {
    await mismatch.findHistory({
      scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
      order: "ASC",
      limit: 10,
    });
  } catch {
    rejected = true;
  }
  assertEqual(rejected, true, "adapter fails closed on scope mismatch");

  const invalid = new SupabaseHistoricalMarketSnapshotRepository({
    config: () => ({
      url: "https://example.supabase.co",
      key: "server-key",
    }),
    fetch: (async () => new Response(
      JSON.stringify([
        {
          id: "malformed",
          effective_at: "2026-10-15T12:29:00.000Z",
          payload: { id: "malformed" },
        },
      ]),
      { status: 200 },
    )) as typeof fetch,
  });

  const skipped = await invalid.findHistory({
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    order: "ASC",
    limit: 10,
  });
  assertEqual(skipped, [], "malformed historical rows are not promoted to Snapshots");
}

void main();

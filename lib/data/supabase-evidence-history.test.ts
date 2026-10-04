import type { Evidence } from "../domain/types";
import { SupabaseHistoricalEvidenceRepository } from "./supabase-evidence-history";

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

function evidence(
  id: string,
  releasedAt: string,
  retrievedAt: string,
  asset: "BTC" | "GOLD" = "BTC",
): Evidence {
  return {
    id,
    sourceId: "gdelt",
    kind: "NEWS",
    subject: `GDELT GAL ${asset} candidate snapshot`,
    content: JSON.stringify({ version: "v1", snapshot: { asset } }),
    capturedAt: retrievedAt,
    retrievedAt,
    releasedAt,
    metadata: {
      methodology: "gdelt-gal-durable-snapshot-v1",
      gdeltAsset: asset,
    },
  };
}

async function main(): Promise<void> {
  const urls: string[] = [];
  const repository = new SupabaseHistoricalEvidenceRepository({
    config: () => ({
      url: "https://example.supabase.co",
      key: "server-key",
    }),
    candidateBatchSize: 10,
    maxCandidateScan: 20,
    fetch: (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify([
          {
            id: "row-early",
            effective_at: "2026-10-04T12:00:00.000Z",
            payload: evidence(
              "evidence-early",
              "2026-10-04T12:00:00.000Z",
              "2026-10-04T12:00:05.000Z",
            ),
          },
          {
            id: "row-late",
            effective_at: "2026-10-04T12:05:00.000Z",
            payload: evidence(
              "evidence-late",
              "2026-10-04T12:05:00.000Z",
              "2026-10-04T12:05:05.000Z",
            ),
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch,
  });

  const history = await repository.findHistory({
    sourceId: "gdelt",
    kind: "NEWS",
    metadataEquals: {
      methodology: "gdelt-gal-durable-snapshot-v1",
      gdeltAsset: "BTC",
    },
    effectiveAtOnOrAfter: "2026-10-04T11:59:00.000Z",
    effectiveAtOnOrBefore: "2026-10-04T12:10:00.000Z",
    retrievedAtOnOrBefore: "2026-10-04T12:04:59.000Z",
    order: "ASC",
    limit: 10,
  });

  assertEqual(
    history.map((item) => item.id),
    ["evidence-early"],
    "retrieval cutoff prevents later NEWS snapshot leakage",
  );

  const query = new URL(urls[0]).searchParams;
  assertEqual(query.get("record_type"), "eq.EVIDENCE", "adapter scopes Evidence rows");
  assertEqual(query.get("payload->>sourceId"), "eq.gdelt", "adapter scopes GDELT source");
  assertEqual(query.get("payload->>kind"), "eq.NEWS", "adapter scopes NEWS kind");
  assertEqual(
    query.get("payload->metadata->>gdeltAsset"),
    "eq.BTC",
    "adapter scopes requested asset metadata",
  );

  const mismatch = new SupabaseHistoricalEvidenceRepository({
    config: () => ({
      url: "https://example.supabase.co",
      key: "server-key",
    }),
    fetch: (async () => new Response(
      JSON.stringify([
        {
          id: "wrong",
          effective_at: "2026-10-04T12:00:00.000Z",
          payload: evidence(
            "wrong",
            "2026-10-04T12:00:00.000Z",
            "2026-10-04T12:00:05.000Z",
            "GOLD",
          ),
        },
      ]),
      { status: 200 },
    )) as typeof fetch,
  });

  let rejected = false;
  try {
    await mismatch.findHistory({
      sourceId: "gdelt",
      kind: "NEWS",
      metadataEquals: { gdeltAsset: "BTC" },
      order: "ASC",
      limit: 10,
    });
  } catch {
    rejected = true;
  }
  assertEqual(rejected, true, "adapter fails closed on metadata identity mismatch");
}

void main();

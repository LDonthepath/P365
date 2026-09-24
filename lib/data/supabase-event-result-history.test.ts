import type { EconomicEventResult } from "../domain/event-result";
import { SupabaseHistoricalEconomicEventResultRepository } from "./supabase-event-result-history";

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

const key = "event:v1:US:2026-10-15T12:30:00.000Z:cpi";

function result(
  id: string,
  retrievedAt: string,
  expected: number,
): EconomicEventResult {
  return {
    id,
    eventId: "provider-event",
    eventIdentityKey: key,
    expected,
    expectedType: "FORECAST",
    unit: "%",
    period: "Sep 2026",
    retrievedAt,
    sourceId: "biquote",
    evidenceId: "evidence-" + id,
  };
}

async function main(): Promise<void> {
  const rows = [
    {
      id: "row-b",
      captured_at: "2026-10-15T12:21:00.000Z",
      payload: result("b", "2026-10-15T12:20:00.000Z", 2.8),
    },
    {
      id: "row-a",
      captured_at: "2026-10-15T10:01:00.000Z",
      payload: result("a", "2026-10-15T10:00:00.000Z", 2.9),
    },
    {
      id: "row-post",
      captured_at: "2026-10-15T12:32:00.000Z",
      payload: result("post", "2026-10-15T12:31:00.000Z", 2.7),
    },
  ];

  const urls: string[] = [];
  const repository = new SupabaseHistoricalEconomicEventResultRepository({
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
    eventIdentityKey: key,
    sourceId: "biquote",
    expectedType: "FORECAST",
    retrievedAtOnOrBefore: "2026-10-15T12:29:59.999Z",
    order: "DESC",
    limit: 10,
  });

  assertEqual(
    history.map((item) => item.id),
    ["b", "a"],
    "canonical retrievedAt cutoff excludes post-release rows",
  );

  const query = new URL(urls[0]).searchParams;
  assertEqual(
    query.get("record_type"),
    "eq.EVENT_RESULT",
    "adapter scopes EVENT_RESULT rows",
  );
  assertEqual(
    query.get("payload->>eventIdentityKey"),
    "eq." + key,
    "adapter scopes provider-independent event identity with raw equality value",
  );
  assertEqual(
    query.get("payload->>sourceId"),
    "eq.biquote",
    "adapter scopes provider provenance with raw equality value",
  );
  assertEqual(
    query.get("payload->>expectedType"),
    "eq.FORECAST",
    "adapter scopes expectation semantics with raw equality value",
  );

  const invalid = new SupabaseHistoricalEconomicEventResultRepository({
    config: () => ({
      url: "https://example.supabase.co",
      key: "server-key",
    }),
    fetch: (async () => new Response(
      JSON.stringify([
        {
          id: "wrong",
          captured_at: "2026-10-15T10:01:00.000Z",
          payload: {
            ...result(
              "wrong",
              "2026-10-15T10:00:00.000Z",
              2.9,
            ),
            eventIdentityKey: "other",
          },
        },
      ]),
      { status: 200 },
    )) as typeof fetch,
  });

  let rejected = false;
  try {
    await invalid.findHistory({
      eventIdentityKey: key,
      sourceId: "biquote",
      order: "ASC",
      limit: 10,
    });
  } catch {
    rejected = true;
  }
  assertEqual(
    rejected,
    true,
    "adapter fails closed on identity mismatch",
  );
}

void main();

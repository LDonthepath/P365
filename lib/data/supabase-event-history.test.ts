import type { Event } from "../domain/types";
import { SupabaseHistoricalEventRepository } from "./supabase-event-history";

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

const scheduledAt = "2026-10-15T12:30:00.000Z";
const identityKey = "event:v1:US:" + scheduledAt + ":cpi";

function event(
  id: string,
  retrievedAt: string,
  overrides: Partial<Event> = {},
): Event {
  return {
    id,
    subject: "CPI",
    description: "US CPI",
    jurisdiction: "US",
    scheduledAt,
    retrievedAt,
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "biquote",
    evidenceId: "evidence-" + id,
    identity: {
      version: "v1",
      key: identityKey,
      semanticKey: "cpi",
      scheduledAt,
      jurisdiction: "US",
    },
    ...overrides,
  };
}

async function main(): Promise<void> {
  const urls: string[] = [];
  const repository = new SupabaseHistoricalEventRepository({
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
            captured_at: "2026-10-15T12:00:01.000Z",
            payload: event("event-early", "2026-10-15T12:00:00.000Z"),
          },
          {
            id: "row-late",
            captured_at: "2026-10-15T12:31:01.000Z",
            payload: event(
              "event-late",
              "2026-10-15T12:31:00.000Z",
              {
                releasedAt: "2026-10-15T12:30:00.000Z",
                occurredAt: "2026-10-15T12:30:00.000Z",
                status: "PAST",
              },
            ),
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch,
  });

  const preHistory = await repository.findHistory({
    eventIdentityKey: identityKey,
    retrievedAtOnOrBefore: "2026-10-15T12:25:00.000Z",
    importance: "HIGH",
    order: "DESC",
    limit: 10,
  });
  assertEqual(
    preHistory.map((item) => item.id),
    ["event-early"],
    "retrievedAt cutoff prevents later Event revision leakage",
  );

  const query = new URL(urls[0]).searchParams;
  assertEqual(query.get("record_type"), "eq.EVENT", "adapter scopes Event rows");
  assertEqual(
    query.get("payload->identity->>key"),
    'eq."' + identityKey + '"',
    "adapter scopes provider-independent identity",
  );
  assertEqual(
    query.get("payload->>importance"),
    'eq."HIGH"',
    "adapter scopes requested importance",
  );

  const rangeHistory = await repository.findHistory({
    scheduledAtOnOrAfter: "2026-10-15T12:29:00.000Z",
    scheduledAtOnOrBefore: "2026-10-15T12:31:00.000Z",
    retrievedAtOnOrBefore: "2026-10-15T12:40:00.000Z",
    order: "ASC",
    limit: 10,
  });
  assertEqual(
    rangeHistory.map((item) => item.id),
    ["event-early", "event-late"],
    "scheduled range and retrieval cutoff preserve eligible revisions",
  );

  const mismatch = new SupabaseHistoricalEventRepository({
    config: () => ({
      url: "https://example.supabase.co",
      key: "server-key",
    }),
    fetch: (async () => new Response(
      JSON.stringify([
        {
          id: "wrong",
          captured_at: "2026-10-15T12:00:01.000Z",
          payload: event(
            "wrong",
            "2026-10-15T12:00:00.000Z",
            {
              identity: {
                version: "v1",
                key: "event:v1:US:" + scheduledAt + ":ppi",
                semanticKey: "ppi",
                scheduledAt,
                jurisdiction: "US",
              },
            },
          ),
        },
      ]),
      { status: 200 },
    )) as typeof fetch,
  });

  let rejected = false;
  try {
    await mismatch.findHistory({
      eventIdentityKey: identityKey,
      order: "ASC",
      limit: 10,
    });
  } catch {
    rejected = true;
  }
  assertEqual(rejected, true, "adapter fails closed on identity mismatch");
}

void main();

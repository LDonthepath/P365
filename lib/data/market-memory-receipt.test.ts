import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";

process.env.SUPABASE_URL = "https://p365-test.supabase.co";
process.env.P365_MEMORY_WRITE_KEY = "unit-only-memory-key";

function obs(id: string): Observation {
  return {
    id,
    domain: "MACRO",
    subject: "Fed Funds",
    value: "4.0",
    observedAt: "2026-10-01T00:00:00.000Z",
    retrievedAt: "2026-10-08T06:30:00.000Z",
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: "evidence-" + id,
  } as Observation;
}

test("physical receipts count DB inserted rows, not submitted rows, on duplicate retries and concurrency", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const oldFetch = globalThis.fetch;
  const keys = new Set<string>();
  const calls: Array<{ url: string; prefer: string; select: boolean }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const prefer = new Headers(init?.headers).get("Prefer") ?? "";
    calls.push({ url, prefer, select: url.includes("select=dedupe_key") });
    const rows = JSON.parse(String(init?.body)) as Array<{ dedupe_key: string }>;
    const inserted = rows.filter((row) => {
      if (keys.has(row.dedupe_key)) return false;
      keys.add(row.dedupe_key);
      return true;
    });
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    assert.ok(prefer.includes("resolution=ignore-duplicates"));
    assert.ok(prefer.includes("return=representation"));
    assert.ok(url.includes("on_conflict=dedupe_key"));
    return Response.json(inserted.map((row) => ({ dedupe_key: row.dedupe_key })), { status: 201 });
  }) as typeof fetch;
  try {
    const input = [obs("a"), obs("b")];
    const first = await supabaseCanonicalRepositories.observations.saveManyWithReceipt(input);
    assert.deepEqual(first, { submitted: 2, inserted: 2, duplicates: 0 });
    const duplicate = await supabaseCanonicalRepositories.observations.saveManyWithReceipt(input);
    assert.deepEqual(duplicate, { submitted: 2, inserted: 0, duplicates: 2 });
    const parallel = await Promise.all([
      supabaseCanonicalRepositories.observations.saveManyWithReceipt([obs("c")]),
      supabaseCanonicalRepositories.observations.saveManyWithReceipt([obs("c")]),
    ]);
    assert.equal(parallel.reduce((sum, item) => sum + item.inserted, 0), 1);
    assert.equal(parallel.reduce((sum, item) => sum + item.duplicates, 0), 1);
    assert.equal(calls.length, 4);
    assert.ok(calls.every((call) => call.select));
    assert.deepEqual(await supabaseCanonicalRepositories.observations.saveManyWithReceipt([]),
      { submitted: 0, inserted: 0, duplicates: 0 });
    assert.equal(calls.length, 4, "empty batch must make no HTTP requests");
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("invalid or missing DB receipt cannot be misreported as an insert count", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const oldFetch = globalThis.fetch;
  const bad = [
    [{ dedupe_key: "invented" }],
    [{ dedupe_key: "bad", payload: "secret" }],
    [{ dedupe_key: "invented" }, { dedupe_key: "invented" }],
  ];
  try {
    for (const rows of bad) {
      globalThis.fetch = (async () => Response.json(rows, { status: 201 })) as typeof fetch;
      await assert.rejects(supabaseCanonicalRepositories.observations.saveManyWithReceipt([obs("a")]),
        /invalid physical insert receipt|duplicate physical insert receipt/);
    }
    globalThis.fetch = (async () => new Response("should not leak", { status: 503 })) as typeof fetch;
    await assert.rejects(supabaseCanonicalRepositories.observations.saveManyWithReceipt([obs("b")]),
      /receipt write failed \(503\)/);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("legacy saveMany still requests minimal representation without changed semantics", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls++;
    assert.equal(new Headers(init?.headers).get("Prefer"),
      "resolution=ignore-duplicates,return=minimal");
    assert.ok(!String(input).includes("select=dedupe_key"));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    await supabaseCanonicalRepositories.observations.saveMany([obs("old")]);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

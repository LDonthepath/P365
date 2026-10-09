import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { MACRO_SERIES_REGISTRY } from "./macro-registry";
import type { Observation } from "../domain/types";

process.env.SUPABASE_URL = "https://p365-test.supabase.co";
process.env.P365_MEMORY_WRITE_KEY = "unit-only-memory-key";

function observation(id: string, sourceId = "fred"): Observation {
  return {
    id, sourceId, domain: "MACRO", subject: "Initial Claims",
    value: "210000", observedAt: "2026-09-26T00:00:00.000Z",
    retrievedAt: "2026-10-09T00:30:00.000Z",
    quality: "FRESH", evidenceId: "ev-" + id,
    identity: {
      version: "v1", seriesKey: "ICSA",
      measurementId: "measurement-v1-test-ICSA-2026-09-26",
      revisionFingerprint: id,
    },
    metadata: { seriesId: "ICSA", unit: "Number", frequency: "WEEKLY" },
  } as Observation;
}

test("installed FRED coordinated RPC allowlist matches every canonical FRED registry series", () => {
  const script = readFileSync(resolve("scripts/ops/obs_fred_001g_install_rpc.sql"), "utf8");
  const match = script.match(/v_series NOT IN \(([^)]+)\)/);
  assert.ok(match, "RPC must explicitly validate FRED series identity");
  const allowed = [...match[1].matchAll(/'([A-Z0-9_]+)'/g)].map((item) => item[1]);
  const registered = MACRO_SERIES_REGISTRY.map((series) => series.seriesId);
  assert.equal(new Set(allowed).size, allowed.length, "RPC list must not contain duplicates");
  assert.deepEqual(allowed.sort(), [...registered].sort(),
    "no registered FRED series may be excluded by a stale database RPC installer");
});

test("optional FRED RPC sends exact canonical rows, exposes bounded revision counts, never source details", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const prior = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    assert.equal(String(input), "https://p365-test.supabase.co/rest/v1/rpc/p365_insert_fred_observations_v1");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer unit-only-memory-key");
    assert.equal(init?.cache, "no-store");
    const data = JSON.parse(String(init?.body)) as { p_rows: Array<{ record_type: string;
      canonical_id: string; dedupe_key: string; payload: Observation }> };
    assert.equal(data.p_rows.length, 1);
    assert.equal(data.p_rows[0]?.record_type, "OBSERVATION");
    assert.equal(data.p_rows[0]?.canonical_id, "fred-rpc-a");
    assert.equal(data.p_rows[0]?.payload.sourceId, "fred");
    assert.ok(data.p_rows[0]?.dedupe_key.includes("fred-rpc-a"));
    return Response.json({ submitted: 1, inserted: 1, duplicates: 0,
      insertedCanonicalIds: ["fred-rpc-a"], revised: 1, revisionAssessment: "COMPLETE" });
  }) as typeof fetch;
  try {
    const result = await supabaseCanonicalRepositories.observations.saveManyWithFredRevisionReceipt(
      [observation("fred-rpc-a")],
    );
    assert.deepEqual(result, { submitted: 1, inserted: 1, duplicates: 0,
      insertedCanonicalIds: ["fred-rpc-a"], revised: 1, revisionAssessment: "COMPLETE" });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = prior; }
});

test("uncertainty must remain null; unqualified physical receipt is rejected", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const prior = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ submitted: 1, inserted: 1, duplicates: 0,
    insertedCanonicalIds: ["fred-rpc-b"], revised: null,
    revisionAssessment: "NOT_EVALUATED" })) as typeof fetch;
  try {
    const result = await supabaseCanonicalRepositories.observations.saveManyWithFredRevisionReceipt(
      [observation("fred-rpc-b")],
    );
    assert.equal(result.revised, null);
    assert.equal(result.revisionAssessment, "NOT_EVALUATED");

    globalThis.fetch = (async () => Response.json({ submitted: 1, inserted: 1, duplicates: 0,
      insertedCanonicalIds: ["foreign-canonical-id"], revised: 0,
      revisionAssessment: "COMPLETE" })) as typeof fetch;
    await assert.rejects(supabaseCanonicalRepositories.observations.saveManyWithFredRevisionReceipt(
      [observation("fred-rpc-b")],
    ), /unqualified receipt/);
  } finally { globalThis.fetch = prior; }
});

test("RPC fails closed on a missing installation and rejects non-FRED inputs without I/O", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const prior = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("sensitive db details", { status: 404 });
  }) as typeof fetch;
  try {
    await assert.rejects(supabaseCanonicalRepositories.observations.saveManyWithFredRevisionReceipt(
      [observation("fred-rpc-c")],
    ), (err: unknown) => err instanceof Error
      && err.message.includes("FRED coordinated write RPC failed (404)")
      && !err.message.includes("sensitive"));
    assert.equal(calls, 1);
    await assert.rejects(supabaseCanonicalRepositories.observations.saveManyWithFredRevisionReceipt(
      [observation("not-fred", "other")],
    ), /non-FRED/);
    assert.equal(calls, 1, "foreign source must be rejected before network");
  } finally { globalThis.fetch = prior; }
});

test("RPC refuses ambiguous physical insert and revision counters", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const prior = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ submitted: 1, inserted: 1, duplicates: 0,
    insertedCanonicalIds: ["fred-rpc-d"], revised: 2, revisionAssessment: "COMPLETE" })) as typeof fetch;
  try {
    await assert.rejects(supabaseCanonicalRepositories.observations.saveManyWithFredRevisionReceipt(
      [observation("fred-rpc-d")],
    ), /unqualified receipt/);
  } finally { globalThis.fetch = prior; }
});

test("bounded SQL lock contention is classified without exposing PostgREST internals", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({
    code: "55P03", message: "sensitive details and SQL", details: "secret",
  }, { status: 500 })) as typeof fetch;
  try {
    await assert.rejects(
      supabaseCanonicalRepositories.observations.saveManyWithFredRevisionReceipt(
        [observation("fred-lock-contention")]),
      (err: unknown) => err instanceof Error
        && err.message.includes("55P03")
        && err.message.includes("transaction aborted")
        && !err.message.includes("sensitive"),
    );
  } finally { globalThis.fetch = previous; }
});

test("transport abort yields UNKNOWN commit outcome, not a confirmed zero-write receipt", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => {
    const err = new Error("secret URL or provider key");
    err.name = "TimeoutError";
    throw err;
  }) as typeof fetch;
  try {
    await assert.rejects(
      supabaseCanonicalRepositories.observations.saveManyWithFredRevisionReceipt(
        [observation("fred-client-timeout")]),
      (err: unknown) => err instanceof Error
        && err.message.includes("commit outcome UNKNOWN")
        && !err.message.includes("secret"),
    );
  } finally { globalThis.fetch = previous; }
});

test("unknown upstream HTTP errors remain generic and never expose the body", async () => {
  const { supabaseCanonicalRepositories } = await import("./market-memory-store");
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({
    code: "PGRST202", message: "secret PostgREST detail",
  }, { status: 404 })) as typeof fetch;
  try {
    await assert.rejects(
      supabaseCanonicalRepositories.observations.saveManyWithFredRevisionReceipt(
        [observation("fred-generic-error")]),
      (err: unknown) => err instanceof Error
        && err.message === "FRED coordinated write RPC failed (404)",
    );
  } finally { globalThis.fetch = previous; }
});

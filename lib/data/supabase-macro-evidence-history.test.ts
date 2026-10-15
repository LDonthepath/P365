import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseMacroEvidenceHistory } from "./supabase-macro-evidence-history";

const T = "2026-10-01T00:00:00.000Z";
test("#370 transport only GETs bounded immutable macro/fred captures before T", async () => {
  let seen = false;
  const fetcher: typeof fetch = async (input, init) => {
    seen = true;
    const uri = new URL(String(input));
    assert.equal(uri.pathname, "/rest/v1/market_memory");
    assert.equal(uri.searchParams.get("record_type"), "eq.OBSERVATION");
    assert.equal(uri.searchParams.get("payload->>domain"), "eq.MACRO");
    assert.equal(uri.searchParams.get("payload->metadata->>seriesId"), "eq.PCEPI");
    assert.equal(uri.searchParams.get("payload->>sourceId"), "eq.fred");
    assert.equal(uri.searchParams.get("captured_at"), "lte." + T);
    assert.equal(uri.searchParams.get("effective_at"), "lte." + T);
    assert.equal(uri.searchParams.get("limit"), "500");
    assert.equal(init?.method, "GET");
    assert.equal(init?.cache, "no-store");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer private-test-key");
    return Response.json([{
      captured_at: "2026-09-30T14:31:12.224Z",
      payload: { id: "canonical-id", domain: "MACRO", sourceId: "fred",
        subject: "PCEPI", value: "131.579", observedAt: "2026-08-01",
        quality: "FRESH", evidenceId: "evidence-pce",
        metadata: { seriesId: "PCEPI", observationDate: "2026-08-01",
          vintageDate: "2026-09-30", unit: "Index 2017=100",
          frequency: "MONTHLY", releasedAt: null } },
    }]);
  };
  const transport = new SupabaseMacroEvidenceHistory({
    fetch: fetcher, config: () => ({ url: "https://unit-test.supabase.co", key: "private-test-key" }),
  });
  const data = await transport.findAsOf({ seriesId: "PCEPI", asOf: T, limit: 500 });
  assert.equal(seen, true);
  assert.equal(data.length, 1);
  assert.equal(data[0].observation.id, "canonical-id");
  assert.equal(data[0].observation.retrievedAt, undefined);
  assert.equal(data[0].capturedAt, "2026-09-30T14:31:12.224Z");
});

test("#370 transport fails closed on malformed, future and unbounded reads", async () => {
  for (const rows of [
    [{ captured_at: "2026-10-02T00:00:00Z", payload: {} }],
    [{ captured_at: "not-a-date", payload: {} }],
    [{ captured_at: "2026-09-30T00:00:00Z", payload: { id: "partial" } }],
    { error: "not an array" },
  ]) {
    const reader = new SupabaseMacroEvidenceHistory({
      config: () => ({ url: "https://unit-test.supabase.co", key: "secret" }),
      fetch: async () => Response.json(rows),
    });
    await assert.rejects(reader.findAsOf({ seriesId: "PCEPI", asOf: T, limit: 500 }));
  }
  const reader = new SupabaseMacroEvidenceHistory({
    config: () => ({ url: "https://unit-test.supabase.co", key: "secret" }),
    fetch: async () => Response.json([]),
  });
  await assert.rejects(reader.findAsOf({ seriesId: "BTC-USD", asOf: T, limit: 500 }));
  await assert.rejects(reader.findAsOf({ seriesId: "PCEPI", asOf: T, limit: 501 }));
  await assert.rejects(reader.findAsOf({ seriesId: "PCEPI", asOf: "invalid", limit: 1 }));
});

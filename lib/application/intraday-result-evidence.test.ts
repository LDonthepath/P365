import assert from "node:assert/strict";
import test from "node:test";
import type { EconomicEventResult } from "../domain/event-result";
import type { Evidence } from "../domain/types";
import { SupabaseHistoricalEvidenceRepository } from "../data/supabase-evidence-history";
import { InMemoryEvidenceRepository } from "../repositories/memory";
import { resolveIntradayResultEvidence } from "./intraday-result-evidence";

const cutoff = "2026-10-02T13:30:00.000Z";
const identity = "event:v1:US:2026-10-02T12:30:00.000Z:nonfarm-payrolls";
const result: EconomicEventResult = {
  id: "result-a", eventId: "event-a", actual: 29,
  sourceId: "biquote", evidenceId: "evidence-a",
  retrievedAt: "2026-10-02T12:34:00.000Z",
};
const evidence: Evidence = {
  id: result.evidenceId, sourceId: result.sourceId, kind: "EVENT",
  subject: "NFP", content: "{}", releasedAt: "2026-10-02T12:30:00.000Z",
  capturedAt: result.retrievedAt, retrievedAt: result.retrievedAt,
  metadata: { eventIdentityKey: identity, multiplier: "thousands" },
};

test("optional read cannot hang even when a repository ignores cancellation", async () => {
  let signal: AbortSignal | undefined;
  const pending = resolveIntradayResultEvidence({
    findHistory(_query, options) {
      signal = options?.signal;
      return new Promise(() => {});
    },
  }, result, identity, cutoff, Date.now() + 75);
  assert.equal(await pending, null);
  assert.equal(signal?.aborted, true);
});

test("an exhausted parent budget skips enrichment without starting another read", async () => {
  let called = false;
  assert.equal(await resolveIntradayResultEvidence({
    async findHistory() { called = true; return [evidence]; },
  }, result, identity, cutoff, Date.now()), null);
  assert.equal(called, false);
});

test("wrong source, event identity, kind, or later-known Evidence fails closed", async () => {
  for (const item of [
    { ...evidence, sourceId: "other" },
    { ...evidence, kind: "NEWS" as const },
    { ...evidence, metadata: { eventIdentityKey: "other" } },
    { ...evidence, retrievedAt: "2026-10-02T14:00:00.000Z" },
    { ...evidence, retrievedAt: "invalid" },
  ]) {
    assert.equal(await resolveIntradayResultEvidence({
      async findHistory() { return [item]; },
    }, result, identity, cutoff), null);
  }
});

test("indexed read retains latest knowable revision under the same cutoff", async () => {
  let requested: URL | undefined;
  const later = { ...evidence, retrievedAt: "2026-10-02T14:00:00.000Z", metadata: { ...evidence.metadata, multiplier: "millions" } };
  const repository = new SupabaseHistoricalEvidenceRepository({
    config: () => ({ url: "https://example.supabase.co", key: "test" }),
    fetch: (async (input) => {
      requested = new URL(String(input));
      return new Response(JSON.stringify([later, evidence].map((payload, index) => ({
        id: `row-${index}`, effective_at: evidence.releasedAt, payload,
      }))));
    }) as typeof fetch,
  });
  const resolved = await resolveIntradayResultEvidence(repository, result, identity, cutoff);
  assert.equal(requested?.searchParams.get("canonical_id"), "eq.evidence-a");
  assert.equal(resolved?.metadata?.multiplier, "thousands");
});

test("Supabase fetch receives optional-read cancellation", async () => {
  let aborted = false;
  const repository = new SupabaseHistoricalEvidenceRepository({
    config: () => ({ url: "https://example.supabase.co", key: "test" }),
    fetch: ((_input, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("cancelled"));
      }, { once: true });
    })) as typeof fetch,
  });
  assert.equal(await resolveIntradayResultEvidence(repository, result, identity, cutoff, Date.now() + 75), null);
  assert.equal(aborted, true);
});

test("in-memory history honors exact Evidence ID and rejects an empty ID", async () => {
  const repository = new InMemoryEvidenceRepository();
  await repository.saveMany([evidence, { ...evidence, id: "unrelated" }]);
  assert.deepEqual((await repository.findHistory({ evidenceId: evidence.id, order: "DESC", limit: 1 })).map(item => item.id), [evidence.id]);
  await assert.rejects(repository.findHistory({ evidenceId: " ", order: "DESC", limit: 1 }), /non-empty/);
});

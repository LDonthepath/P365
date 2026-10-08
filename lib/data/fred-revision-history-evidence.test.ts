import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { buildObservationIdentity, observationRevisionId } from "../domain/observation-identity";
import { proveFredRevision } from "../application/fred-revision-proof";
import { SupabaseFredRevisionHistoryEvidenceReader } from "./fred-revision-history-evidence";

const observedAt = "2026-08-01T00:00:00.000Z";
const before = "2026-09-20T23:03:41.189Z";
const after = "2026-10-02T13:31:07.375Z";
const config = () => ({ url: "https://p365-test.supabase.co", key: "unit-test-key" });

function row(value: string, capturedAt: string, options: {
  legacy?: boolean; sourceColumn?: string | null; seriesId?: string;
  effectiveAt?: string; actualPeriod?: string; idOverride?: string;
  actualSource?: string; unit?: string; createdAt?: string;
} = {}) {
  const seriesId = options.seriesId ?? "PAYEMS";
  const identity = buildObservationIdentity({
    domain: "MACRO", seriesKey: seriesId,
    observedAt: options.actualPeriod ?? observedAt, sourceId: "fred",
    value, unit: options.unit ?? "Thousands of Persons", frequency: "Monthly",
  });
  const id = options.idOverride ?? (options.legacy ? "legacy-" + value
    : observationRevisionId(identity));
  const observation: Observation = {
    id, domain: "MACRO", subject: "Payroll", value,
    observedAt: options.actualPeriod ?? observedAt,
    retrievedAt: capturedAt, sourceId: options.actualSource ?? "fred",
    evidenceId: "evidence-" + value, quality: "FRESH",
    metadata: { seriesId, unit: options.unit ?? "Thousands of Persons", frequency: "Monthly" },
    ...(options.legacy ? {} : { identity }),
  };
  return {
    canonical_id: id,
    source_id: options.sourceColumn === undefined
      ? options.legacy ? null : "fred" : options.sourceColumn,
    captured_at: capturedAt,
    created_at: options.createdAt ?? capturedAt,
    effective_at: options.effectiveAt ?? observedAt,
    payload: observation,
  };
}

function adapter(data: unknown, onRequest?: (url: URL, init?: RequestInit) => void) {
  let calls = 0;
  const reader = new SupabaseFredRevisionHistoryEvidenceReader({
    config,
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      calls++;
      onRequest?.(new URL(String(input)), init);
      return Response.json(data);
    }) as typeof fetch,
  });
  return { reader, calls: () => calls };
}

test("reads both modern and legacy FRED source-column representations without ignoring NULL legacy", async () => {
  const a = row("159075", before, { legacy: true });
  const b = row("159015", after);
  const { reader, calls } = adapter([b, a], (url, init) => {
    assert.equal(url.pathname, "/rest/v1/market_memory");
    assert.equal(url.searchParams.get("record_type"), "eq.OBSERVATION");
    assert.equal(url.searchParams.get("effective_at"), "eq." + observedAt);
    assert.equal(url.searchParams.get("payload->metadata->>seriesId"), "eq.PAYEMS");
    assert.equal(url.searchParams.get("payload->>sourceId"), "eq.fred");
    assert.equal(url.searchParams.get("source_id"), null,
      "Filtering stored source_id excludes 823 known legacy FRED rows");
    assert.equal(url.searchParams.get("limit"), "65");
    assert.equal(url.searchParams.get("order"), "captured_at.desc,canonical_id.asc");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.method, undefined, "GET only; must not write canonical data");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer unit-test-key");
  });
  const r = await reader.readPeriod({ seriesId: "PAYEMS", observedAt });
  assert.equal(calls(), 1);
  assert.equal(r.records.length, 2);
  assert.equal(r.records[0].sourceColumn, "fred");
  assert.equal(r.records[1].sourceColumn, null);
  assert.equal(r.records[0].observation.value, "159015");
  assert.equal(r.periodRowsetBounded, true);
  assert.equal(r.orderingProven, false);
  assert.equal(r.insertedIdentityProven, false);
  assert.equal(r.completeHistoricalOrderingProven, false);
  assert.equal(r.orderingStatus, "NOT_EVALUATED");
  assert.equal(r.timestampProvenance, "APPLICATION_CAPTURED_AT_DB_TRANSACTION_START_CREATED_AT");
  assert.equal(proveFredRevision({
    candidate: r.records[0], history: r.records.slice(1),
    physicallyInserted: true,
    historyComplete: r.periodRowsetBounded,
    orderingProven: r.orderingProven,
  }).status, "NOT_EVALUATED", "No commit-order proof even when both versions were returned");
});

test("empty response is not authorization to call a new measurement/revision verified", async () => {
  const r = await adapter([]).reader.readPeriod({ seriesId: "SOFR", observedAt });
  assert.equal(r.records.length, 0);
  assert.equal(r.orderingProven, false);
  assert.equal(r.insertedIdentityProven, false);
});

test("rejects unknown series and noncanonical UTC timestamp before any HTTP request", async () => {
  const x = adapter([]);
  for (const seriesId of ["INVALID", "payems", "PAYEMS&foo=bar"]) {
    await assert.rejects(x.reader.readPeriod({ seriesId, observedAt }), /registered seriesId/);
  }
  for (const date of ["2026-08-01","2026-08-01T00:00:00Z",
    "2026-08-01T07:00:00.000+07:00", "garbage"]) {
    await assert.rejects(x.reader.readPeriod({ seriesId:"PAYEMS", observedAt:date }),
      /canonical UTC/);
  }
  assert.equal(x.calls(), 0);
});

test("rejects overflow and invalid top-level response instead of using incomplete history", async () => {
  const overflow = Array.from({ length: 65 }, (_,i) =>
    row(String(159000+i), after, { legacy: true, idOverride:"legacy-"+i }));
  for (const data of [overflow, { data: [row("159015", after)] }]) {
    await assert.rejects(adapter(data).reader.readPeriod({seriesId:"PAYEMS",observedAt}),
      /strict 64-row bound/);
  }
});

test("rejects duplicates and spoofed or inconsistent canonical data", async () => {
  const valid=row("159015",after);
  const mismatches=[
    { ...valid, source_id:"unqualified-source" },
    { ...valid, payload:{ ...valid.payload, sourceId:"another-provider" } },
    { ...valid, payload:{ ...valid.payload, metadata:{...valid.payload.metadata, seriesId:"UNRATE"} } },
    { ...valid, payload:{ ...valid.payload, identity:{
      ...valid.payload.identity, seriesKey:"UNRATE" } } },
    { ...valid, payload:{ ...valid.payload, identity:"invalid-identity-string" } },
    { ...valid, payload:{ ...valid.payload, identity:{
      ...valid.payload.identity, version:"v0" } } },
    { ...valid, effective_at:"2026-07-01T00:00:00.000Z" },
    { ...valid, canonical_id:"wrong-canonical-id" },
    { ...valid, created_at:"malformed-timestamp" },
    { ...valid, payload:{ ...valid.payload, metadata:{
      ...valid.payload.metadata, unit:"" } } },
  ];
  for (const invalid of mismatches) {
    await assert.rejects(adapter([invalid]).reader.readPeriod({seriesId:"PAYEMS",observedAt}),
      /canonical provenance validation/);
  }
  await assert.rejects(adapter([valid,valid]).reader.readPeriod({seriesId:"PAYEMS",observedAt}),
    /duplicate canonical identities/);
});

test("handles HTTP 403 or malformed response without printing secrets or provider URLs", async () => {
  let calls=0;
  const reader=new SupabaseFredRevisionHistoryEvidenceReader({
    config,
    fetch: (async () => { calls++; return new Response("private-key unit-test-key", {status:403}); }) as typeof fetch,
  });
  await assert.rejects(reader.readPeriod({seriesId:"PAYEMS",observedAt}), (err:unknown) => {
    assert.ok(err instanceof Error);
    assert.match(err.message,/read failed \(403\)/);
    assert.ok(!err.message.includes("unit-test-key"));
    assert.ok(!err.message.includes("private-key"));
    return true;
  });
  assert.equal(calls,1);
  const invalidJSON=new SupabaseFredRevisionHistoryEvidenceReader({
    config,fetch:(async()=>new Response("{bad")) as typeof fetch,
  });
  await assert.rejects(invalidJSON.readPeriod({seriesId:"PAYEMS",observedAt}),
    /not valid JSON/);
  const unreachable=new SupabaseFredRevisionHistoryEvidenceReader({
    config,fetch:(async()=>{throw Error("upstream credential unit-test-key");}) as typeof fetch,
  });
  await assert.rejects(unreachable.readPeriod({seriesId:"PAYEMS",observedAt}),
    /read unavailable/);
});

test("date and URL normalization prevents unqualified request origins", async () => {
  const reader = new SupabaseFredRevisionHistoryEvidenceReader({
    config:() => ({url:"http://unsafe.example", key:"unit-test-key"}),
    fetch:(async()=>{throw Error("must never fetch");}) as typeof fetch,
  });
  await assert.rejects(reader.readPeriod({seriesId:"PAYEMS",observedAt}),
    /server-side configuration/);
});

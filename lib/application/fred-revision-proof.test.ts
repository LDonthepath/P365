import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { buildObservationIdentity, observationRevisionId } from "../domain/observation-identity";
import {
  proveFredRevision,
  summarizeFredRevisionProofs,
  type FredRevisionEvidenceRow,
  type FredRevisionProofInput,
} from "./fred-revision-proof";

function row(value: string, capturedAt: string, opts: {
  id?: string;
  series?: string;
  date?: string;
  unit?: string;
  frequency?: string;
  legacy?: boolean;
  sourceId?: string;
  domain?: Observation["domain"];
} = {}): FredRevisionEvidenceRow {
  const series = opts.series ?? "PAYEMS";
  const observedAt = opts.date ?? "2026-08-01T00:00:00.000Z";
  const sourceId = opts.sourceId ?? "fred";
  const domain = opts.domain ?? "MACRO";
  const unit = opts.unit ?? "Thousands of Persons";
  const frequency = opts.frequency ?? "Monthly";
  const identity = buildObservationIdentity({ domain, seriesKey: series, observedAt, sourceId,
    value, unit, frequency });
  const observation: Observation = {
    id: opts.id ?? (opts.legacy ? "legacy-"+value : observationRevisionId(identity)),
    domain, subject: "Total Nonfarm Payrolls", sourceId,
    value, observedAt, retrievedAt: capturedAt, evidenceId: "ev-"+value,
    quality: "FRESH",
    metadata: { seriesId: series, unit, frequency },
    ...(opts.legacy ? {} : { identity }),
  };
  return { observation, capturedAt };
}

const early = "2026-09-20T23:03:41.189Z";
const late = "2026-10-02T13:31:07.375Z";

function input(candidate: FredRevisionEvidenceRow, history: FredRevisionEvidenceRow[] = []):
  FredRevisionProofInput {
  return { candidate, history, physicallyInserted: true, historyComplete: true,
    orderingProven: true };
}

test("actual PAYEMS value change 159075 → 159015 is a verified historical revision", () => {
  const p=proveFredRevision(input(row("159015",late),[row("159075",early)]));
  assert.equal(p.status,"PROVEN_FACTUAL_REVISION");
  assert.equal(p.revised,true);
  assert.equal(p.reason,"VALUE_CHANGED");
});

test("matching legacy representation is NOT a factual revision", () => {
  const p=proveFredRevision(input(row("159075",late),[row("159075",early,{legacy:true})]));
  assert.equal(p.status,"IDENTITY_ONLY_OR_EQUIVALENT");
  assert.equal(p.revised,false);
});

test("legacy previous value that actually differs qualifies with units/source/period", () => {
  const p=proveFredRevision(input(row("159015",late),[row("159075",early,{legacy:true})]));
  assert.equal(p.status,"PROVEN_FACTUAL_REVISION");
});

test("numeric format only (1.59075e5 vs 159075.000) is equivalent", () => {
  const p=proveFredRevision(input(row("159075.000",late),[row("1.59075e5",early,{legacy:true})]));
  assert.equal(p.status,"IDENTITY_ONLY_OR_EQUIVALENT");
});

test("complete and empty earlier history is PROVEN_NEW_MEASUREMENT in P365", () => {
  const p=proveFredRevision(input(row("159075",late)));
  assert.equal(p.status,"PROVEN_NEW_MEASUREMENT");
  assert.equal(p.revised,false);
});

test("missing physical-insert/ordering/history proof fails closed", () => {
  for (const prop of ["physicallyInserted","historyComplete","orderingProven"] as const) {
    const criteria={...input(row("159015",late),[row("159075",early)]),[prop]:false};
    assert.equal(proveFredRevision(criteria).status,"NOT_EVALUATED",prop);
  }
});

test("mismatched units/frequency/source/period/semantic series are NOT_EVALUATED", () => {
  const original=row("159015",late);
  const mismatches=[
    row("159075",early,{unit:"Persons"}),
    row("159075",early,{frequency:"Weekly"}),
    row("159075",early,{sourceId:"different"}),
    row("159075",early,{date:"2026-07-01T00:00:00Z"}),
    row("159075",early,{series:"CPIAUCSL"}),
    row("159075",early,{domain:"ASSET"}),
  ];
  for (const v of mismatches) assert.equal(
    proveFredRevision(input(original,[v])).status,"NOT_EVALUATED",v.observation.id);
});

test("unqualified DTWEXBGS unit base remains NOT_EVALUATED even if values differ", () => {
  const current=row("120",late,{series:"DTWEXBGS",unit:"Index Mar 1973=100"});
  const previous=row("119",early,{series:"DTWEXBGS",unit:"Index Mar 1973=100"});
  assert.equal(proveFredRevision(input(current,[previous])).status,"NOT_EVALUATED");
});

test("unproven DB write chronology and ties never imply a fact revision", () => {
  const current=row("159015",late);
  for (const older of [
    row("159075",late,{id:"concurrent"}),
    row("159075","2026-10-03T13:00:00Z"),
    row("159075","not-a-date"),
  ]) assert.equal(proveFredRevision(input(current,[older])).status,"NOT_EVALUATED");
  const tie=input(current,[
    row("159075",early,{id:"old-a"}),
    row("159074",early,{id:"old-b"}),
  ]);
  assert.equal(proveFredRevision(tie).status,"NOT_EVALUATED");
});

test("most recent preceding version determines factual change, not arbitrary older match", () => {
  const current=row("159075","2026-10-06T12:00:00Z");
  const versions=[
    row("159075","2026-09-20T00:00:00Z",{id:"initial"}),
    row("159015",late,{id:"latest"}),
  ];
  const p=proveFredRevision(input(current,versions));
  assert.equal(p.status,"PROVEN_FACTUAL_REVISION");
  assert.equal(p.priorObservationId,"latest");
});

test("missing/invalid identity, inconsistent modern identity, legacy series mismatch are unknown", () => {
  const current=row("159015",late);
  const missingId={...current,observation:{...current.observation,identity:undefined}};
  assert.equal(proveFredRevision(input(missingId,[])).status,"NOT_EVALUATED");
  const mismatch={...current,observation:{...current.observation,
    metadata:{seriesId:"UNRATE",unit:"Thousands of Persons",frequency:"Monthly"}}};
  assert.equal(proveFredRevision(input(mismatch,[])).status,"NOT_EVALUATED");
  const malformedOld={...row("159075",early),observation:{
    ...row("159075",early).observation, identity:{
      ...row("159075",early).observation.identity!, measurementId:"different-measurement",
    },
  }};
  assert.equal(proveFredRevision(input(current,[malformedOld])).status,"NOT_EVALUATED");
});

test("history bound and partial classification make batch revised null", () => {
  const current=row("159015",late);
  const large=Array.from({length:65},(_,i)=>row(String(159075-i),
    new Date(Date.parse(early)-i*1000).toISOString(),{id:"id-"+i}));
  assert.equal(proveFredRevision(input(current,large)).status,"NOT_EVALUATED");
  const good=proveFredRevision(input(current,[row("159075",early)]));
  const unknown=proveFredRevision({...input(current,[row("159075",early)]),historyComplete:false});
  assert.deepEqual(summarizeFredRevisionProofs([good,unknown]),{
    revised:null,evaluated:1,notEvaluated:1,coverage:"NOT_EVALUATED",
  });
  assert.deepEqual(summarizeFredRevisionProofs([good]),{
    revised:1,evaluated:1,notEvaluated:0,coverage:"COMPLETE",
  });
  assert.deepEqual(summarizeFredRevisionProofs([]),{
    revised:0,evaluated:0,notEvaluated:0,coverage:"COMPLETE",
  });
});

test("candidate itself can appear in a post-insert history read without being counted as predecessor",()=>{
  const current=row("159015",late);
  const p=proveFredRevision(input(current,[current,row("159075",early)]));
  assert.equal(p.status,"PROVEN_FACTUAL_REVISION");
});

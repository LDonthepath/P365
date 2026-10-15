import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  qualifySoSoValueBtcEtfFlowRows,
  SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
  SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
  SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
  SOSOVALUE_ETF_FLOW_SOURCE_ID,
  type SoSoValueBtcEtfFlowObservationInput,
} from "./sosovalue-etf-flow";

const RETRIEVED_AT = "2026-09-30T12:00:00.000Z";
const rows = () => [
  { date: "2026-09-30", total_net_inflow: 300 },
  { date: "2026-09-29", total_net_inflow: 0 },
  { date: "2026-09-28", total_net_inflow: -125.5 },
  { date: "2026-09-26", total_net_inflow: 100 },
];
const forward = (payload: unknown) =>
  qualifySoSoValueBtcEtfFlowRows(payload, RETRIEVED_AT, { mode: "FORWARD" });

test("MACRO-CUT-004: SoSoValue provider sequence witness excludes newest row, preserves factual zero and negative", () => {
  const data = forward(rows());
  assert.deepEqual(data.map(row => row.providerTradingDate), ["2026-09-29", "2026-09-28", "2026-09-26"]);
  assert.deepEqual(data.map(row => row.value), [0, -125.5, 100]);
  assert.equal(data[0]?.maturityPolicy, SOSOVALUE_ETF_FLOW_MATURITY_POLICY);
  assert.equal(data[0]?.completionBasis, SOSOVALUE_ETF_FLOW_COMPLETION_BASIS);
  assert.equal(data[0]?.providerResource, SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE);
  assert.equal(data[0]?.provenance.observationDate, "2026-09-29");
  assert.equal(data[0]?.metadata.maturityStatus, "MATURED_ELIGIBLE_UNDER_P365_POLICY");
  assert.equal(SOSOVALUE_ETF_FLOW_SOURCE_ID, "sosovalue-etf-flow");
  const typed: SoSoValueBtcEtfFlowObservationInput = data[0]!;
  assert.equal(typed.metricId, "crypto.us_spot_btc_etf_net_flow.usd");
});
test("MACRO-CUT-004: no wall-clock finality, only same-response later trading date qualifies", () => {
  assert.deepEqual(forward([{ date: "2020-01-02", total_net_inflow: 100 }]), []);
  assert.deepEqual(forward({ code: 0, message: "success", data: [
    { date: "2020-01-03", total_net_inflow: 101 },
    { date: "2020-01-02", total_net_inflow: 100 },
  ] }).map(x => x.providerTradingDate), ["2020-01-02"]);
  assert.deepEqual(forward({ code: 0, details: { request_id: "provider-only" }, data: rows() }).map(x => x.providerTradingDate),
    ["2026-09-29", "2026-09-28", "2026-09-26"]);
});
test("MACRO-CUT-004: malformed envelopes, duplicate, invalid, disordered, and future values fail closed", () => {
  const invalid: unknown[] = [
    {}, { data: [] }, { code: 2, data: rows() },
    { code: 0, data: {}, message: "success" },
    { code: 0, data: [], unexpected: true },
    [{ total_net_inflow: 1 }],
    [{ date: "09/29/2026", total_net_inflow: 1 }],
    [{ date: "2026-02-30", total_net_inflow: 1 }],
    [{ date: "2026-09-29", total_net_inflow: null }],
    [{ date: "2026-09-29", total_net_inflow: "0" }],
    [{ date: "2026-09-29", total_net_inflow: Number.NaN }],
    [{ date: "2026-09-29", total_net_inflow: Number.POSITIVE_INFINITY }],
    [{ date: "2026-09-29", total_net_inflow: Number.NEGATIVE_INFINITY }],
    [{ date: "2026-09-29", total_net_inflow: 1 },{ date: "2026-09-29", total_net_inflow: 2 }],
    [{ date: "2026-09-28", total_net_inflow: 1 },{ date: "2026-09-29", total_net_inflow: 2 }],
    [{ date: "2026-10-01", total_net_inflow: 1 },{ date: "2026-09-30", total_net_inflow: 2 }],
  ];
  for (const payload of invalid) assert.throws(() => forward(payload), /SoSoValue malformed payload/, JSON.stringify(payload));
  assert.throws(() => qualifySoSoValueBtcEtfFlowRows(rows(),"invalid",{mode:"FORWARD"}), /retrieval timestamp is invalid/);
});
test("MACRO-CUT-004: backfill is inclusive, sorted by provider, with witness and coverage proof", () => {
  const query = (from: string, to: string) =>
    qualifySoSoValueBtcEtfFlowRows(rows(), RETRIEVED_AT, { mode: "BACKFILL", range: { from, to } });
  assert.deepEqual(query("2026-09-26","2026-09-29").map(x=>x.providerTradingDate), ["2026-09-29","2026-09-28","2026-09-26"]);
  assert.deepEqual(query("2026-09-27","2026-09-27"), []);
  assert.throws(()=>query("2026-09-29","2026-09-30"), /strictly earlier/);
  assert.throws(()=>query("2026-09-01","2026-09-05"), /coverage/);
  assert.throws(()=>query("2026-02-30","2026-03-01"), /valid from\/to date bounds/);
  assert.throws(()=>query("2026-09-30","2026-09-01"), /valid from\/to date bounds/);
  assert.throws(()=>query("2025-01-01","2026-09-01"), /limited to 28 calendar days/);
  assert.throws(()=>qualifySoSoValueBtcEtfFlowRows(rows(),RETRIEVED_AT,{mode:"BACKFILL"}), /explicit from\/to/);
  assert.throws(()=>qualifySoSoValueBtcEtfFlowRows([],RETRIEVED_AT,{mode:"BACKFILL",range:{from:"2026-09-26",to:"2026-09-29"}}), /empty response/);
});
test("MACRO-CUT-004: historical source DTO remains and live SoSoValue transport absent", () => {
  const src = readFileSync(new URL("./sosovalue-etf-flow.ts", import.meta.url),"utf8");
  const contract = readFileSync(new URL("../application/historical-ingestion-contract.ts", import.meta.url),"utf8");
  const normalized = readFileSync(new URL("../application/historical-ingestion-normalization.ts", import.meta.url),"utf8");
  assert.match(src,/export type SoSoValueBtcEtfFlowObservationInput/);
  assert.match(src,/SOSOVALUE_ETF_FLOW_MATURITY_POLICY/);
  assert.doesNotMatch(src,/server-only|fetchSoSoValueBtcEtfFlowObservations|SOSOVALUE_API_KEY|x-soso-api-key|providerFetchPolicy/);
  assert.match(contract,/SoSoValueBtcEtfFlowObservationInput/);
  assert.match(normalized,/SoSoValueBtcEtfFlowObservationInput/);
});

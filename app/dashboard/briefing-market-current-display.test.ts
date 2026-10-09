import assert from "node:assert/strict";
import test from "node:test";
import type { BriefingMarketMove, FactualMarketBriefing } from "@/lib/application/factual-market-briefing";
import { marketCurrentSummary, presentMarketMove } from "./briefing-market-current-display";

function move(overrides: Partial<BriefingMarketMove> = {}): BriefingMarketMove {
  return {
    asset: "GOLD", seriesKey: "gold.futures.usd", sourceId: "harga",
    observedAt: "2026-10-09T08:00:00Z",
    marketContext: { currentValue: 4030.25, changePercent: 1.2, changeBasis: "PREVIOUS_CLOSE", valueUnit: "USD" },
    status: "BELOW_MATERIALITY_THRESHOLD",
    hasMaterialMove: false, horizons: [],
    evidence: null, causalAttribution: "NOT_EVALUATED",
    ...overrides,
  } as BriefingMarketMove;
}

test("perubahan Emas terhadap penutupan sebelumnya tidak diklaim 24 jam", () => {
  const props = presentMarketMove(move());
  assert.equal(props.price, "US$ 4.030,25");
  assert.equal(props.priceDetail, null);
  assert.equal(props.change?.comparisonLabel, "Perubahan terhadap penutupan sebelumnya");
  assert.doesNotMatch(JSON.stringify(props.change), /24 jam/);
  assert.equal(props.change?.direction, "up");
  assert.equal(props.badge, null);
});
test("bukti yang belum tersedia ditandai hanya saat ada pergerakan material", () => {
  const props = presentMarketMove(move({ status: "MATERIAL_MOVE", hasMaterialMove: true }));
  assert.equal(props.badge?.label, "Bukti pergerakan material belum tersedia untuk dinilai");
  assert.equal(props.badge?.tone, "neutral");
});
test("basis 24 jam khusus ROLLING_24H, UNAVAILABLE tetap eksplisit", () => {
  const base = move({asset:"BTC",marketContext:{currentValue: 120500,changePercent:-2.55,changeBasis:"ROLLING_24H",valueUnit:"USD"}});
  const props = presentMarketMove(base);
  assert.equal(props.price, "US$ 120.500");
  assert.equal(props.priceDetail, "per 1 BTC");
  assert.equal(props.change?.comparisonLabel, "Perubahan dalam 24 jam");
  assert.equal(props.change?.direction, "down");
  assert.equal(presentMarketMove(move({marketContext:{currentValue:12,changePercent:0,changeBasis:"UNAVAILABLE",valueUnit:"USD"}})).change?.comparisonLabel, "Basis perubahan belum tersedia");
});
test("empat horizon terukur dipetakan tanpa membuat riwayat atau mengisi data hilang", () => {
  const props = presentMarketMove(move({horizons: [
    {horizonMinutes:15,status:"BELOW_MATERIALITY_THRESHOLD",signedPercentChange:0.5},
    {horizonMinutes:30,status:"INSUFFICIENT_DATA",signedPercentChange:null},
    {horizonMinutes:60,status:"MATERIAL_MOVE",signedPercentChange:-2},
  ] as BriefingMarketMove["horizons"]}));
  assert.deepEqual(props.horizons.map(h => h.label),["15 menit","30 menit","60 menit","120 menit"]);
  assert.deepEqual(props.horizons.map(h => h.valueLabel),["+0,50%",null,"-2,00%",null]);
  assert.deepEqual(props.horizons.map(h => h.barLengthPercent),[25,null,100,null]);
  assert.deepEqual(props.horizons.map(h => h.direction),["up","unknown","down","unknown"]);
});
test("nilai kosong/NaN tidak menjadi nol; nol terukur tetap nol yang sah", () => {
  const props = presentMarketMove(move({horizons: [
    {horizonMinutes:15,status:"MATERIAL_MOVE",signedPercentChange:Number.NaN},
    {horizonMinutes:30,status:"BELOW_MATERIALITY_THRESHOLD",signedPercentChange:0},
  ] as BriefingMarketMove["horizons"]}));
  assert.deepEqual(props.horizons.map(h=>h.valueLabel),[null,"0,00%",null,null]);
  assert.deepEqual(props.horizons.map(h=>h.barLengthPercent),[null,0,null,null]);
  assert.equal(presentMarketMove(move({marketContext:{currentValue:NaN,changePercent:null,changeBasis:"UNAVAILABLE",valueUnit:"USD"}})).price,null);
});
test("badge hanya kelengkapan bukti dari field existing", () => {
  for(const [completeness, label, tone] of [
    ["EVIDENCE_COMPLETE","Bukti lengkap","complete"],
    ["EVIDENCE_INCOMPLETE","Bukti pendukung belum lengkap","partial"],
  ] as const) {
    const props=presentMarketMove(move({evidence:{evidenceCompleteness:completeness} as BriefingMarketMove["evidence"]}));
    assert.equal(props.badge?.label,label);
    assert.equal(props.badge?.tone,tone);
  }
});
test("ringkasan hanya memakai evidenceStatus dan materialMoveCount yang sudah ada", () => {
  const baseline = {evidenceStatus:"AVAILABLE", reasoningStatus:"NOT_EVALUATED", materialMoveCount:2,items:[],reason:null} as FactualMarketBriefing["marketMoves"];
  assert.match(marketCurrentSummary(baseline)??"",/2 pergerakan intraday/);
  assert.match(marketCurrentSummary({...baseline,materialMoveCount:0})??"",/Tidak ada pergerakan/);
  assert.equal(marketCurrentSummary({...baseline,evidenceStatus:"INSUFFICIENT"}),null);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { MaterialMoveAssetReadModel, MaterialMoveEvidenceSummary } from "../application/material-move-monitor";
import { presentMaterialMoveInvestigation } from "./material-move-investigation";
export const START="2026-10-10T07:00:20Z", END="2026-10-10T08:00:30Z", ASOF="2026-10-10T08:03:00Z";
const point=(id:string,value:number,observedAt:string)=>({observationId:id,value,observedAt,retrievedAt:ASOF,quality:"FRESH" as const});
export function fixture(asset:"BTC"|"GOLD"="BTC"): MaterialMoveAssetReadModel {
  const evidence: MaterialMoveEvidenceSummary={asOf:ASOF,evidenceCompleteness:"EVIDENCE_INCOMPLETE",
    investigationWindow:{startAt:START,endAt:END},synchronousCoverage:"PARTIAL",
    synchronousFingerprint:[{horizonMinutes:60,coverage:"PARTIAL",series:[
      {seriesKey:"dxy.index.usd",sourceId:"yahoo-finance",state:"AVAILABLE_SYNCHRONOUS",signedPercentChange:-0.3,start:point("dxy-start",100,START),end:point("dxy-end",99.7,END)},
      {seriesKey:"eth.spot.usd",sourceId:"coingecko-market",state:"AVAILABLE_SYNCHRONOUS",signedPercentChange:1,start:point("eth-start",2000,START),end:point("eth-end",2020,END)},
      {seriesKey:"gold.futures.usd",sourceId:"yahoo-finance",state:"AVAILABLE_SYNCHRONOUS",signedPercentChange:-1.2,start:point("gold-start",4000,START),end:point("gold-end",3952,END)},
    ]}],scheduledCatalystCount:0,scheduledCatalystCoverage:"COMPLETE",scheduledCatalysts:[],
    unscheduledCandidateCount:0,unscheduledCatalystCoverage:"UNAVAILABLE",unscheduledCandidates:[],
    slowBackground:{state:"AVAILABLE_BACKGROUND",items:asset === "BTC" ? [
      {kind:"BTC_ETF_NET_FLOW",state:"AVAILABLE_BACKGROUND",reason:null,observations:[{seriesKey:"crypto.us_spot_btc_etf_net_flow.usd",sourceId:"sosovalue-etf-flow",value:66190000,unit:"USD",observedAt:"2026-10-08T00:00:00Z",retrievedAt:"2026-10-09T01:27:00Z",quality:"UNKNOWN"}]},
      {kind:"USD_STABLECOIN_LIQUIDITY",state:"AVAILABLE_BACKGROUND",reason:null,observations:[{seriesKey:"crypto.usd_stablecoin_market_cap.usd",sourceId:"defillama-stablecoins",value:311470000000,unit:"USD",observedAt:"2026-10-10T00:00:00Z",retrievedAt:"2026-10-10T01:17:00Z",quality:"FRESH"}]},
    ]:[{kind:"GOLD_CFTC_POSITIONING",state:"AVAILABLE_BACKGROUND",reason:null,observations:[{seriesKey:"gold.cftc.managed_money.long.contracts",sourceId:"cftc-gold-cot",value:12345,unit:"CONTRACTS",observedAt:"2026-10-06T00:00:00Z",retrievedAt:"2026-10-09T22:48:00Z",quality:"UNKNOWN"}]}]},
    cryptoMarketStructure:asset === "BTC" ? {state:"INSUFFICIENT_DATA",reason:"existing",components:[{component:"BTC_DERIVATIVES",state:"INSUFFICIENT_DATA",reason:"existing"}]}:null,
    intradayRatesPricing:{state:"MISSING_HIGH_VALUE_EVIDENCE",reason:"existing",policy:"FREE_ONLY_NO_APPROVED_RUNTIME"},
    btcSpotFlow:asset === "BTC" ? {state:"AVAILABLE_SYNCHRONOUS",startAt:START,endAt:END,coverage:"PARTIAL",venue:"BINANCE",pair:"BTCUSDT",windowMinutes:60,observedWindowCount:1,expectedWindowCount:12,totalBaseVolumeBtc:10,takerBuyBaseVolumeBtc:7,takerSellBaseVolumeBtc:3,netTakerBaseVolumeBtc:4,takerBuyShare:0.7,tradeCount:100,
      windows:[{evidenceId:"flow",windowKey:"flow-key",observedAt:"2026-10-10T08:00:00Z",retrievedAt:ASOF,totalBaseVolumeBtc:10,takerBuyBaseVolumeBtc:7,takerSellBaseVolumeBtc:3,netTakerBaseVolumeBtc:4,takerBuyShare:0.7,tradeCount:100}]}:null};
  return {asset,seriesKey:asset === "BTC" ? "btc.spot.usd":"gold.futures.usd",sourceId:asset === "BTC"?"coingecko-market":"yahoo-finance",observedAt:END,marketContext:null,status:"MATERIAL_MOVE",hasMaterialMove:true,
    horizons:[{horizonMinutes:60,targetStartObservedAt:START,targetEndObservedAt:END,status:"MATERIAL_MOVE",signedPercentChange:asset === "BTC"?2.1:-1.2,materialityThresholdPercent:0.5,targetPercentileRank:99,historicalSampleSize:400}],evidence,causalAttribution:"NOT_EVALUATED"};
}
const present=(item=fixture())=>presentMaterialMoveInvestigation(item,ASOF)!;
test("BTC facts preserve signed return, real endpoints, source and partial coverage; background separate",()=>{
  const result=present();assert.equal(result.facts.length,3);
  assert.match(result.facts[0].text,/DXY.*-0,3%.*60 menit.*14\.00\.20.*15\.00\.30.*Yahoo Finance.*sebagian/);
  assert.match(result.facts[2].text,/Binance Spot BTCUSDT.*7 BTC.*3 BTC.*5 menit.*15\.00\.00.*1\/12.*bukan seluruh pasar/);
  assert.match(result.background.map(p=>p.text).join(" "),/66\.190\.000 USD.*SoSoValue/);
  assert.doesNotMatch(result.facts.map(f=>f.text).join(" "),/ETF|stablecoin|CFTC/);
  assert.equal(result.causalAttribution,"NOT_EVALUATED");
});
test("Gold Futures keeps COMEX GC=F identity and CFTC only background",()=>{
  const result=present(fixture("GOLD"));assert.match(result.title,/Emas berjangka COMEX \(GC=F\)/);
  assert.match(result.facts[2].text,/COMEX \(GC=F\).*−?(-1,2)%/);
  assert.match(result.background[0].text,/long Managed Money COMEX Gold.*12\.345 kontrak.*CFTC/);
  assert.doesNotMatch(JSON.stringify(result),/XAU\/USD|Gold Spot|SoSoValue|Binance/);
});
test("future retrievedAt rejected in every evidence role and cutoff mismatch fails closed",()=>{
  const item=fixture();const e=item.evidence!;
  e.synchronousFingerprint[0].series[0].end!.retrievedAt="2026-10-10T08:04:00Z";
  e.btcSpotFlow!.windows![0].retrievedAt="2026-10-10T08:04:00Z";
  e.slowBackground.items[0].observations![0].retrievedAt="2026-10-10T08:04:00Z";
  e.scheduledCatalysts=[{eventId:"future",eventIdentityKey:null,subject:"Future event",jurisdiction:"US",importance:"HIGH",scheduledAt:END,retrievedAt:"2026-10-10T08:04:00Z",sourceId:"biquote"}];
  e.unscheduledCandidates=[{url:"https://news.example/future",title:"Future news",domain:"news.example",providerDate:END,providerDateSemantics:"PUBLICATION_OR_FIRST_SEEN",temporalFit:"WITHIN_MOVE_WINDOW",firstSeenRetrievedAt:"2026-10-10T08:04:00Z",firstSnapshotEvidenceId:"future"}];
  const result=present(item);assert.doesNotMatch(JSON.stringify(result.facts),/DXY|Future|volume pembeli/);
  assert.doesNotMatch(JSON.stringify(result.background),/66\.190\.000/);assert.match(result.gaps.join(" "),/cutoff/);
  e.asOf="2026-10-10T08:04:00Z";assert.equal(present(item).facts.length,0);
});
test("all input orders preserve selected facts, background and gaps",()=>{
  const item=fixture();item.horizons.push({...item.horizons[0],horizonMinutes:30,signedPercentChange:1,targetStartObservedAt:"2026-10-10T07:30:30Z"});
  const expected=present(item);item.horizons.reverse();item.evidence!.synchronousFingerprint.reverse();item.evidence!.synchronousFingerprint[0].series.reverse();item.evidence!.slowBackground.items.reverse();
  assert.deepEqual(present(item),expected);
});
test("different horizons never merged and misalignment/missing endpoints excluded",()=>{
  const item=fixture();item.evidence!.synchronousFingerprint.push({horizonMinutes:120,coverage:"COMPLETE",series:[{...item.evidence!.synchronousFingerprint[0].series[0],signedPercentChange:999}]});
  assert.doesNotMatch(JSON.stringify(present(item).facts),/999|120 menit/);
  item.evidence!.synchronousFingerprint[0].series[0].start!.observedAt="2026-10-10T06:00:20Z";
  item.evidence!.synchronousFingerprint[0].series[1].end=undefined;
  assert.doesNotMatch(JSON.stringify(present(item).facts),/DXY|ETH/);
});
test("scheduled and dated news are candidates, undated news is only an explicit gap",()=>{
  const item=fixture();const e=item.evidence!;e.synchronousFingerprint=[];e.btcSpotFlow=null;
  e.scheduledCatalysts=[{eventId:"cpi",eventIdentityKey:null,subject:"CPI AS",jurisdiction:"US",importance:"HIGH",scheduledAt:END,retrievedAt:ASOF,sourceId:"biquote"}];e.scheduledCatalystCount=1;
  e.unscheduledCandidates=[{url:"https://news.example/btc",title:"Bitcoin infrastructure update",domain:"news.example",providerDate:END,providerDateSemantics:"PUBLICATION_OR_FIRST_SEEN",temporalFit:"WITHIN_MOVE_WINDOW",firstSeenRetrievedAt:ASOF,firstSnapshotEvidenceId:"news"}];e.unscheduledCandidateCount=1;e.unscheduledCatalystCoverage="PARTIAL";
  const result=present(item);assert.equal(result.facts.length,2);assert.match(result.facts[0].text,/Biquote.*Jadwal\/kandidat saja/);assert.match(result.facts[1].text,/publikasi atau pertama terlihat.*GDELT GAL.*sebagian.*belum menjadi bukti penyebab/);
  e.unscheduledCandidates[0].providerDate=null;e.unscheduledCandidates[0].temporalFit="TIMESTAMP_UNAVAILABLE";
  assert.equal(present(item).facts.length,1);assert.match(present(item).gaps.join(" "),/timestamp yang tidak tersedia/);
});
test("qualified zero-result differs from unavailable, partial and query-limited coverage",()=>{
  for(const coverage of ["COMPLETE","UNAVAILABLE","BOUNDED_QUERY_LIMIT_REACHED"] as const){
    const item=fixture();item.evidence!.scheduledCatalystCoverage=coverage;item.evidence!.unscheduledCatalystCoverage=coverage;
    const gaps=present(item).gaps.join(" ");
    if(coverage === "COMPLETE") assert.match(gaps,/Tidak ada kandidat.*pencarian.*qualified/);
    else {assert.doesNotMatch(gaps,/Tidak ada kandidat/);assert.match(gaps,coverage === "UNAVAILABLE" ? /tidak tersedia/ : /batas kueri/);}
  }
  const gaps=present().gaps.join(" ");assert.match(gaps,/Derivatif BTC.*data belum cukup/);assert.match(gaps,/Fingerprint sinkron.*sebagian/);assert.match(gaps,/Rates\/pricing intraday.*belum tersedia/);assert.match(gaps,/Investigasi belum lengkap/);
});
test("no material move exits before reading evidence; no speculation or scores in generated prose",()=>{
  for(const status of ["BELOW_MATERIALITY_THRESHOLD","INSUFFICIENT_DATA","UNKNOWN","UNAVAILABLE"] as const){
    const item=fixture();item.status=status;item.hasMaterialMove=false;Object.defineProperty(item,"evidence",{get(){throw Error("evidence must not be accessed");}});
    assert.equal(presentMaterialMoveInvestigation(item,ASOF),null);
  }
  assert.doesNotMatch(JSON.stringify(present()),/\bBUY\b|\bSELL\b|bullish|bearish|risk.on|risk.off|confidence|causal score|whale|naik karena/i);
});

test("detector → monitor → presentation retains canonical points and adds no reads; no-trigger does not query investigations",async()=>{
  const {buildMaterialMoveMonitor}=await import("../application/material-move-monitor");
  const {InMemoryObservationRepository}=await import("../repositories/memory");
  const end=Date.parse(END);
  const {repo, rows}=await (async()=>{
    const repo=new InMemoryObservationRepository();
    const rows=Array.from({length:481},(_,i)=>({id:`btc-${i}`,domain:"ASSET" as const,subject:"BTC",value:String(i===480?110:100+i*0.001),observedAt:new Date(end-(480-i)*300000).toISOString(),retrievedAt:new Date(end-(480-i)*300000).toISOString(),sourceId:"coingecko-market",quality:"FRESH" as const,evidenceId:`e-${i}`,metadata:{metricId:"btc.spot.usd",unit:"USD",frequency:"5m"}}));
    for(const row of rows)await repo.save(row);
    for(const [key,provider,startValue,endValue] of [["dxy.index.usd","yahoo-finance",100,99.7],["eth.spot.usd","coingecko-market",2000,2020]] as const){
      for(const [at,value]of [[rows[456].observedAt,startValue],[END,endValue]] as const)await repo.save({...rows[0],id:`${key}:${at}`,subject:key,value:String(value),observedAt:at,retrievedAt:at,sourceId:provider,metadata:{metricId:key,unit:"USD",frequency:"5m"}});
    }
    await repo.save({...rows[0],id:"stable",domain:"MARKET",sourceId:"defillama-stablecoins",value:"300000000000",observedAt:"2026-10-10T00:00:00Z",retrievedAt:"2026-10-10T01:17:00Z",metadata:{metricId:"crypto.usd_stablecoin_market_cap.usd",unit:"USD",frequency:"DAILY"}});
    return {repo,rows};
  })();
  const history=repo;let obsReads=0,eventReads=0,evidenceReads=0;
  const input={asOf:ASOF,observations:{async findHistory(q:Parameters<typeof history.findHistory>[0]){obsReads++;return history.findHistory(q);}},events:{async findHistory(){eventReads++;return [];}},evidence:{async findHistory(){evidenceReads++;return [];}}};
  const monitor=await buildMaterialMoveMonitor(input);assert.equal(monitor.assets[0].status,"MATERIAL_MOVE");
  const btc=monitor.assets[0],fp=btc.evidence!.synchronousFingerprint.find(f=>f.horizonMinutes===120)!.series.find(s=>s.seriesKey==="dxy.index.usd")!;
  assert.equal(fp.start!.observedAt,rows[456].observedAt);assert.equal(fp.end!.observedAt,END);
  assert.equal(fp.end!.retrievedAt,END);assert.equal(btc.evidence!.asOf,ASOF);
  assert.equal(btc.evidence!.slowBackground.items.find(b=>b.kind==="USD_STABLECOIN_LIQUIDITY")!.observations![0].sourceId,"defillama-stablecoins");
  const before=[obsReads,eventReads,evidenceReads];const result=presentMaterialMoveInvestigation(btc,ASOF)!;
  assert.match(result.facts[0].text,/DXY.*-0,3%.*120 menit.*Yahoo Finance/);assert.deepEqual([obsReads,eventReads,evidenceReads],before);
  assert.equal(eventReads,1);
  const missing=await buildMaterialMoveMonitor({...input,observations:{async findHistory(){return [];}}});
  assert.equal(missing.assets[0].status,"UNAVAILABLE");assert.equal(presentMaterialMoveInvestigation(missing.assets[0],ASOF),null);assert.deepEqual([eventReads,evidenceReads],[before[1],before[2]]);
  const incomplete=await buildMaterialMoveMonitor({...input,observations:{async findHistory(q){return q.identity.seriesKey === "btc.spot.usd" ? [rows[480]]:[];}}});
  assert.equal(incomplete.assets[0].status,"INSUFFICIENT_DATA");assert.equal(incomplete.assets[0].evidence,null);assert.deepEqual([eventReads,evidenceReads],[before[1],before[2]]);
});

test("MOVE UI exposes three sections outside details, translated states and native collapse markup",async()=>{
  const React=await import("react");(globalThis as typeof globalThis & {React?:typeof React}).React=React;
  const {renderToStaticMarkup}=await import("react-dom/server");
  const {MaterialMoveMonitorPanel}=await import("../../app/dashboard/material-move-monitor-panel");
  const html=renderToStaticMarkup(React.createElement(MaterialMoveMonitorPanel,{data:{asOf:ASOF,status:"OK",assets:[fixture(),fixture("GOLD")],causalAttribution:"NOT_EVALUATED"}}));
  assert.equal((html.match(/class="move-investigation-summary"/g)??[]).length,2);
  const summary=html.slice(html.indexOf('<section class="move-investigation-summary"'),html.indexOf('</section>',html.indexOf('<section class="move-investigation-summary"')));
  assert.match(summary,/Fakta kontemporer.*Konteks latar.*Bukti belum cukup/);
  assert.match(summary,/harian\/mingguan ini bukan bukti penyebab/);assert.doesNotMatch(summary,/<details|EVIDENCE_INCOMPLETE|AVAILABLE_BACKGROUND|NOT_EVALUATED/);
  assert.match(html,/<details[^>]*><summary><span>Detail detektor intraday/);
  assert.match(html,/Investigasi evidence/);assert.match(html,/Kalibrasi historis lintas aset/);
  assert.doesNotMatch(html,/INTRADAY NORMAL|XAU\/USD/);
  const item=fixture();item.status="INSUFFICIENT_DATA";item.hasMaterialMove=false;item.evidence=null;
  const empty=renderToStaticMarkup(React.createElement(MaterialMoveMonitorPanel,{data:{asOf:ASOF,status:"PARTIAL",assets:[item],causalAttribution:"NOT_EVALUATED"}}));
  assert.match(empty,/PENILAIAN BELUM LENGKAP|DATA BELUM CUKUP/);assert.doesNotMatch(empty,/move-investigation-summary|TANPA ALERT|INTRADAY NORMAL/);
});


test("repository errors and invalid news snapshots are distinct from unavailable data",()=>{
  const item=fixture();item.evidence!.scheduledCatalystCoverage="UNAVAILABLE";
  item.evidence!.scheduledCatalystReason="Historical Event repository read failed.";
  item.evidence!.unscheduledCatalystReason="Historical Evidence repository read failed for GDELT NEWS snapshots.";
  assert.match(present(item).gaps.join(" "),/riwayat peristiwa terjadwal gagal/);
  assert.match(present(item).gaps.join(" "),/riwayat berita GDELT gagal/);
  item.evidence!.unscheduledCatalystReason="Qualified GDELT durable history contains an invalid snapshot payload.";
  assert.match(present(item).gaps.join(" "),/snapshot tidak valid/);
  assert.doesNotMatch(present().gaps.join(" "),/riwayat berita GDELT gagal/);
});

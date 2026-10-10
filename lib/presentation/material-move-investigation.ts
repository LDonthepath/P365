import type { MaterialMoveAssetReadModel, MaterialMoveBackgroundObservation } from "../application/material-move-monitor";
import { screenMoveCatalystTitles } from "./move-catalyst-titles";

export const MOVE_LABELS = { BTC: "Bitcoin (BTC)", GOLD: "Emas berjangka COMEX (GC=F)" } as const;
const SERIES: Record<string, string> = {
  "btc.spot.usd": "BTC spot", "eth.spot.usd": "ETH spot", "dxy.index.usd": "DXY (DX-Y.NYB)",
  "gold.futures.usd": MOVE_LABELS.GOLD, "fx.usdjpy.jpy_per_usd": "USD/JPY",
  "fx.usdcnh.cnh_per_usd": "USD/CNH",
  "crypto.usd_stablecoin_market_cap.usd": "Kapitalisasi stablecoin USD (harian)",
  "crypto.us_spot_btc_etf_net_flow.usd": "Arus neto harian ETF spot BTC AS",
};
const SOURCES: Record<string, string> = {
  "coingecko-market": "CoinGecko", "yahoo-finance": "Yahoo Finance",
  "binance-spot": "Binance Spot", "gdelt": "GDELT GAL", "sosovalue-etf-flow": "SoSoValue",
  "defillama-stablecoins": "DefiLlama", "cftc-gold-cot": "CFTC",
  "biquote": "Biquote", "forex-factory": "Forex Factory", "federal-reserve": "Federal Reserve",
};
const COVERAGE = { COMPLETE: "lengkap", PARTIAL: "sebagian", EMPTY: "kosong",
  BOUNDED_QUERY_LIMIT_REACHED: "dibatasi batas kueri", UNAVAILABLE: "tidak tersedia" } as const;
const QUALITY = { FRESH: "terbaru saat diperoleh", STALE: "tertunda saat diperoleh",
  PARTIAL: "sebagian", UNKNOWN: "belum pasti" } as const;
const BACKGROUND = { USD_STABLECOIN_LIQUIDITY: "Likuiditas stablecoin USD (harian)",
  BTC_ETF_NET_FLOW: "Arus ETF spot BTC AS (harian)", GOLD_CFTC_POSITIONING: "Posisi futures COMEX Gold CFTC (mingguan)" } as const;
const COMPONENT = { BTC_DERIVATIVES: "Derivatif BTC", BTC_SPOT_FLOW: "Arus transaksi spot BTC",
  BTC_SPOT_ORDER_BOOK: "Buku pesanan spot BTC", BTC_PERP_ORDER_BOOK: "Buku pesanan perpetual BTC" } as const;
const STATE = { AVAILABLE_SYNCHRONOUS: "tersedia pada jendela yang selaras",
  AVAILABLE_BACKGROUND: "tersedia sebagai konteks latar", INSUFFICIENT_DATA: "data belum cukup",
  MISSING_HIGH_VALUE_EVIDENCE: "bukti penting belum tersedia", UNKNOWN: "penilaian belum pasti" } as const;
export type InvestigationFact = { id: string; text: string };
export type MaterialMoveInvestigation = {
  title: string; window: string | null; facts: InvestigationFact[]; background: InvestigationFact[];
  gaps: string[]; causalAttribution: "NOT_EVALUATED";
};
function time(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}
function interval(start: string, end: string): string { return `${time(start)}–${time(end)} WIB`; }
function number(value: number): string { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value); }
function signed(value: number): string { return `${value > 0 ? "+" : ""}${number(value)}%`; }
function known(value: string | undefined, cutoff: number): boolean {
  return !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= cutoff;
}
function source(id: string): string { return SOURCES[id] ?? id; }
function backgroundText(point: MaterialMoveBackgroundObservation): string {
  const label = SERIES[point.seriesKey] ?? (point.seriesKey.includes("managed_money.long")
    ? "Posisi long Managed Money COMEX Gold (mingguan)" : point.seriesKey.includes("managed_money.short")
      ? "Posisi short Managed Money COMEX Gold (mingguan)" : point.seriesKey);
  return `${label}: ${number(point.value)} ${point.unit === "USD" ? "USD" : "kontrak"}. Observasi ${time(point.observedAt)} WIB; sumber ${source(point.sourceId)}; kualitas ${QUALITY[point.quality]}.`;
}

/** Presentation only. Stable order: horizon by detector absolute return, longer horizon,
 * then series DXY/ETH/other companions/target and lexical lineage. At most two fingerprint
 * facts reserve one slot for the latest aligned Binance 5m window; remaining slots use
 * fingerprint, scheduled event, then dated news. No return/evidence recalculation or reads.
 */
export function presentMaterialMoveInvestigation(item: MaterialMoveAssetReadModel, asOf: string): MaterialMoveInvestigation | null {
  if (item.status !== "MATERIAL_MOVE" || !item.hasMaterialMove) return null;
  const result: MaterialMoveInvestigation = { title: `Ringkasan Investigasi Pergerakan · ${MOVE_LABELS[item.asset]}`,
    window: null, facts: [], background: [], gaps: [], causalAttribution: "NOT_EVALUATED" };
  const evidence = item.evidence;
  const cutoff = Date.parse(asOf);
  if (!evidence || !Number.isFinite(cutoff) || !evidence.asOf || Date.parse(evidence.asOf) !== cutoff
    || !known(evidence.investigationWindow.startAt, cutoff) || !known(evidence.investigationWindow.endAt, cutoff)
    || Date.parse(evidence.investigationWindow.startAt) >= Date.parse(evidence.investigationWindow.endAt)) {
    result.gaps.push("Paket investigasi atau batas waktu pengetahuannya belum tersedia/selaras.");
    result.background.push({ id: "background-unavailable", text: "Konteks latar belum tersedia pada batas waktu investigasi." });
    return result;
  }
  const window = evidence.investigationWindow;
  result.window = `${interval(window.startAt, window.endAt)}. Batas pengetahuan ${time(asOf)} WIB.`;
  const horizons = [...item.horizons].filter(h => h.status === "MATERIAL_MOVE" && h.signedPercentChange !== null && Number.isFinite(h.signedPercentChange))
    .sort((a,b) => Math.abs(b.signedPercentChange!) - Math.abs(a.signedPercentChange!) || b.horizonMinutes-a.horizonMinutes || JSON.stringify(a).localeCompare(JSON.stringify(b)));
  let rejected = false;
  const fingerprint: InvestigationFact[] = [];
  const seriesSeen = new Set<string>();
  const priority = (key: string) => key === item.seriesKey ? 9 : key === "dxy.index.usd" ? 0 : key === "eth.spot.usd" ? 1 : 2;
  for (const horizon of horizons) {
    const groups = evidence.synchronousFingerprint.filter(f => f.horizonMinutes === horizon.horizonMinutes);
    const entries = groups.flatMap(f => f.series.map(s => ({ s, coverage: f.coverage })))
      .sort((a,b) => priority(a.s.seriesKey)-priority(b.s.seriesKey) || a.s.seriesKey.localeCompare(b.s.seriesKey)
        || JSON.stringify(a).localeCompare(JSON.stringify(b)));
    for (const { s, coverage } of entries) {
      if (s.state !== "AVAILABLE_SYNCHRONOUS" || seriesSeen.has(s.seriesKey)) continue;
      const start = s.start, end = s.end;
      if (!start || !end || !s.sourceId || !known(start.retrievedAt, cutoff) || !known(end.retrievedAt, cutoff)
        || !known(start.observedAt, cutoff) || !known(end.observedAt, cutoff)
        || !horizon.targetStartObservedAt || !horizon.targetEndObservedAt
        || Math.abs(Date.parse(start.observedAt)-Date.parse(horizon.targetStartObservedAt)) > 120_000
        || Math.abs(Date.parse(end.observedAt)-Date.parse(horizon.targetEndObservedAt)) > 120_000
        || Date.parse(start.observedAt) >= Date.parse(end.observedAt)
        || ![start.quality,end.quality].every(q => q === "FRESH" || q === "STALE")
        || !Number.isFinite(start.value) || !Number.isFinite(end.value)
        || s.signedPercentChange === null || !Number.isFinite(s.signedPercentChange)) { rejected = true; continue; }
      seriesSeen.add(s.seriesKey);
      fingerprint.push({ id: `market:${horizon.horizonMinutes}:${s.seriesKey}:${start.observationId}:${end.observationId}`,
        text: `${SERIES[s.seriesKey] ?? s.seriesKey} ${signed(s.signedPercentChange)} pada horizon ${horizon.horizonMinutes} menit; pengamatan ${interval(start.observedAt,end.observedAt)} beririsan dengan jendela pergerakan. Sumber ${source(s.sourceId)}; cakupan fingerprint ${COVERAGE[coverage]}; kualitas awal/akhir ${QUALITY[start.quality]}/${QUALITY[end.quality]}.` });
    }
  }
  const spot = evidence.btcSpotFlow;
  let spotFact: InvestigationFact | null = null;
  if (item.asset === "BTC" && spot?.state === "AVAILABLE_SYNCHRONOUS" && spot.coverage !== "BOUNDED_QUERY_LIMIT_REACHED"
    && spot.startAt === window.startAt && spot.endAt === window.endAt) {
    const windows = [...(spot.windows ?? [])].sort((a,b) => b.observedAt.localeCompare(a.observedAt) || a.evidenceId.localeCompare(b.evidenceId));
    for (const w of windows) {
      // Existing durable contract: observedAt is the completed source-native 5m boundary.
      if (!known(w.retrievedAt,cutoff) || !known(w.observedAt,cutoff) || Date.parse(w.observedAt) <= Date.parse(window.startAt)
        || Date.parse(w.observedAt) > Date.parse(window.endAt) || ![w.takerBuyBaseVolumeBtc,w.takerSellBaseVolumeBtc].every(Number.isFinite)) { rejected=true; continue; }
      spotFact = { id: `spot:${w.evidenceId}`, text: `Binance Spot BTCUSDT: volume pembeli taker ${number(w.takerBuyBaseVolumeBtc)} BTC dan penjual taker ${number(w.takerSellBaseVolumeBtc)} BTC pada interval selesai 5 menit berakhir ${time(w.observedAt)} WIB. Sumber Binance Spot; cakupan ${COVERAGE[spot.coverage]} (${spot.observedWindowCount}/${spot.expectedWindowCount} interval). Data satu venue, bukan seluruh pasar BTC.` }; break;
    }
  }
  result.facts = spotFact ? [...fingerprint.slice(0,2),spotFact] : fingerprint.slice(0,3);
  const catalysts: InvestigationFact[] = [];
  const inWindow = (date: string) => known(date,cutoff) && Date.parse(date) >= Date.parse(window.startAt) && Date.parse(date) <= Date.parse(window.endAt);
  for (const event of [...evidence.scheduledCatalysts].sort((a,b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.eventId.localeCompare(b.eventId) || JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
    if (!known(event.retrievedAt,cutoff) || !inWindow(event.scheduledAt)) { rejected=true; continue; }
    catalysts.push({id:`event:${event.eventId}`,text:`Peristiwa terjadwal: ${event.subject}, jadwal ${time(event.scheduledAt)} WIB di dalam jendela investigasi. Sumber ${source(event.sourceId)}; cakupan pencarian ${COVERAGE[evidence.scheduledCatalystCoverage]}. Jadwal/kandidat saja; kejadian aktual dan penyebab tidak disimpulkan.`});
  }
  const screened = screenMoveCatalystTitles(evidence.unscheduledCandidates,item.asset);
  for (const news of [...screened.items].sort((a,b) => (a.providerDate ?? "").localeCompare(b.providerDate ?? "") || a.url.localeCompare(b.url) || JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
    if (!known(news.firstSeenRetrievedAt,cutoff)) {rejected=true;continue;}
    if (news.temporalFit !== "WITHIN_MOVE_WINDOW" || news.providerDateSemantics !== "PUBLICATION_OR_FIRST_SEEN" || !news.providerDate || !inWindow(news.providerDate)) continue;
    catalysts.push({id:`news:${news.url}`,text:`Kandidat berita: “${news.title}” (${news.domain}), timestamp publikasi atau pertama terlihat ${time(news.providerDate)} WIB di dalam jendela. Sumber GDELT GAL; cakupan ${COVERAGE[evidence.unscheduledCatalystCoverage]}. Kandidat saja, belum menjadi bukti penyebab.`});
  }
  result.facts.push(...catalysts.slice(0,3-result.facts.length));
  const expected = item.asset === "BTC" ? ["USD_STABLECOIN_LIQUIDITY","BTC_ETF_NET_FLOW"] as const : ["GOLD_CFTC_POSITIONING"] as const;
  for (const kind of expected) {
    const items = evidence.slowBackground.items.filter(b => b.kind === kind);
    const points = items.filter(b => b.state === "AVAILABLE_BACKGROUND").flatMap(b => b.observations ?? [])
      .filter(p => {const eligible = known(p.retrievedAt,cutoff) && known(p.observedAt,cutoff) && !!p.sourceId && Number.isFinite(p.value); if(!eligible)rejected=true;return eligible;})
      .sort((a,b) => a.seriesKey.localeCompare(b.seriesKey) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if(points.length) result.background.push(...points.map(p=>({id:`background:${kind}:${p.seriesKey}`,text:backgroundText(p)})));
    else result.background.push({id:`background:${kind}`,text:`${BACKGROUND[kind]}: ${items.some(b=>b.state === "UNKNOWN") ? "sumber/riwayat tidak dapat dipastikan" : "data qualified belum tersedia pada cutoff"}.`});
  }
  if (evidence.scheduledCatalystReason === "Historical Event repository read failed.") {
    result.gaps.push("Pembacaan riwayat peristiwa terjadwal gagal; pencarian kandidat belum dapat dilakukan dengan memadai.");
  }
  if (evidence.unscheduledCatalystReason === "Historical Evidence repository read failed for GDELT NEWS snapshots.") {
    result.gaps.push("Pembacaan riwayat berita GDELT gagal; ketiadaan kandidat belum dapat ditentukan.");
  } else if (evidence.unscheduledCatalystReason === "Qualified GDELT durable history contains an invalid snapshot payload.") {
    result.gaps.push("Riwayat berita GDELT berisi snapshot tidak valid; cakupan belum dapat dinilai.");
  }
  if(evidence.synchronousCoverage !== "COMPLETE") result.gaps.push(`Fingerprint sinkron belum lengkap: cakupan ${COVERAGE[evidence.synchronousCoverage]}.`);
  if(evidence.scheduledCatalystCoverage !== "COMPLETE") result.gaps.push(evidence.scheduledCatalystCoverage === "UNAVAILABLE" ? "Pencarian peristiwa terjadwal tidak tersedia; ketiadaan kandidat belum dapat ditentukan." : "Pencarian peristiwa terjadwal dibatasi batas kueri; kelengkapan belum dapat dipastikan.");
  else if(evidence.scheduledCatalystCount === 0) result.gaps.push("Tidak ada kandidat peristiwa terjadwal ditemukan pada pencarian qualified dalam jendela ini; bukan bukti bahwa tidak ada peristiwa di luar cakupan.");
  if(evidence.unscheduledCatalystCoverage !== "COMPLETE") result.gaps.push(`Pencarian berita ${evidence.unscheduledCatalystCoverage === "UNAVAILABLE" ? "tidak tersedia" : evidence.unscheduledCatalystCoverage === "BOUNDED_QUERY_LIMIT_REACHED" ? "dibatasi batas kueri" : evidence.unscheduledCatalystCoverage === "EMPTY" ? "belum memiliki data feed yang memadai" : "hanya mencakup sebagian jendela"}; hasil belum membuktikan ketiadaan kandidat.`);
  else if(evidence.unscheduledCandidateCount === 0) result.gaps.push("Tidak ada kandidat berita ditemukan pada pencarian feed qualified dalam jendela ini.");
  if(evidence.unscheduledCandidateCount > 0) result.gaps.push("Berita yang tercatat masih kandidat; timestamp yang tidak tersedia tidak membuktikan keselarasan dengan pergerakan.");
  if(screened.excludedTitleCount) result.gaps.push(`${screened.excludedTitleCount} judul promosi/topik lain disaring dari tampilan; cakupan feed tetap mengikuti evidence existing.`);
  for(const c of [...(evidence.cryptoMarketStructure?.components ?? [])].sort((a,b)=>a.component.localeCompare(b.component))) {
    if(c.state !== "AVAILABLE_SYNCHRONOUS") result.gaps.push(`${COMPONENT[c.component]}: ${STATE[c.state]}.`);
  }
  if(item.asset === "BTC" && (!spot || spot.coverage !== "COMPLETE")) result.gaps.push(`Cakupan arus spot Binance ${spot ? COVERAGE[spot.coverage] : "belum tersedia"}; belum mewakili jendela lengkap atau seluruh pasar.`);
  result.gaps.push(`Rates/pricing intraday: ${STATE[evidence.intradayRatesPricing.state]}; belum ada runtime gratis yang disetujui.`);
  if(rejected) result.gaps.push("Sebagian evidence tidak ditampilkan karena timestamp, provenance, kualitas atau keselarasan cutoff belum memenuhi syarat.");
  if(!result.facts.length) result.gaps.push("Belum ada fakta kontemporer yang layak ditampilkan dari evidence pada cutoff ini.");
  if(evidence.evidenceCompleteness === "EVIDENCE_INCOMPLETE") result.gaps.push("Investigasi belum lengkap menurut kontrak evidence existing; penyebab pergerakan belum dapat dijelaskan.");
  return result;
}

"use client";

import type { FactualMarketBriefing } from "@/lib/application/factual-market-briefing";
import { formatEventResultValue } from "@/lib/presentation/intraday-event-response";
import { screenMoveCatalystTitles } from "@/lib/presentation/move-catalyst-titles";
import {
  formatBriefingBasisPoints,
  formatBriefingNumber,
  formatBriefingPercent,
} from "./briefing-number-format";
import type { Direction } from "./components/briefing-primitives";
import { ChartCard, KpiCard, SectionHeader, StatusBadge } from "./components/briefing-primitives";
import { marketCurrentSummary, presentMarketMove } from "./briefing-market-current-display";

const SERIES_LABELS: Record<string, string> = {
  DGS2: "US Treasury 2Y",
  DGS10: "US Treasury 10Y",
  DFII10: "US 10Y Real Yield",
  T10YIE: "10Y Breakeven Inflation",
  T10Y2Y: "10Y–2Y Spread",
};

const PRICING_LABELS: Record<string, string> = {
  "btc.spot.usd": "Bitcoin",
  "eth.spot.usd": "Ethereum",
  "dxy.index.usd": "Dolar AS (DXY)",
  "gold.futures.usd": "Emas",
};

const MOVE_ASSET_LABELS = {
  BTC: "Bitcoin",
  GOLD: "Emas",
} as const;

const MOVE_ASSESSMENT_LABELS: Record<
  FactualMarketBriefing["marketMoves"]["items"][number]["status"],
  string
> = {
  MATERIAL_MOVE: "INTRADAY TIDAK BIASA",
  BELOW_MATERIALITY_THRESHOLD: "INTRADAY NORMAL",
  INSUFFICIENT_DATA: "DATA BELUM CUKUP",
  INCOMPATIBLE: "DATA TIDAK KOMPATIBEL",
  UNKNOWN: "STATUS BELUM PASTI",
  UNAVAILABLE: "DATA TIDAK TERSEDIA",
};

const MOVE_HORIZON_LABELS: Record<string, string> = {
  MATERIAL_MOVE: "material",
  BELOW_MATERIALITY_THRESHOLD: "belum material",
  INSUFFICIENT_DATA: "data belum cukup",
  INCOMPATIBLE: "data tidak kompatibel",
  UNKNOWN: "status belum pasti",
};

const MOVE_COVERAGE_LABELS: Record<string, string> = {
  COMPLETE: "lengkap",
  PARTIAL: "sebagian",
  EMPTY: "kosong",
  BOUNDED_QUERY_LIMIT_REACHED: "batas query tercapai",
  UNAVAILABLE: "tidak tersedia",
};

const MOVE_SERIES_LABELS: Record<string, string> = {
  "btc.spot.usd": "BTC",
  "eth.spot.usd": "ETH",
  "dxy.index.usd": "DXY",
  "gold.futures.usd": "Gold",
  "fx.usdjpy.jpy_per_usd": "USD/JPY",
  "fx.usdcnh.cnh_per_usd": "USD/CNH",
};

const MOVE_IMPORTANCE_LABELS: Record<string, string> = {
  HIGH: "dampak tinggi",
  MEDIUM: "dampak sedang",
  LOW: "dampak rendah",
};

const MOVE_TEMPORAL_FIT_LABELS: Record<string, string> = {
  WITHIN_MOVE_WINDOW: "waktu provider berada dalam window",
  TIMESTAMP_UNAVAILABLE: "waktu publikasi provider tidak tersedia",
};

const MOVE_EVIDENCE_STATE_LABELS: Record<string, string> = {
  AVAILABLE_SYNCHRONOUS: "TERSEDIA",
  AVAILABLE_BACKGROUND: "LATAR BELAKANG",
  AVAILABLE_CATALYST: "TERSEDIA",
  MISSING_HIGH_VALUE_EVIDENCE: "BELUM TERSEDIA",
  INSUFFICIENT_DATA: "DATA BELUM CUKUP",
  UNKNOWN: "STATUS BELUM PASTI",
};

const MOVE_BACKGROUND_LABELS: Record<string, string> = {
  USD_STABLECOIN_LIQUIDITY: "Likuiditas stablecoin USD",
  BTC_ETF_NET_FLOW: "Arus ETF Bitcoin AS",
  GOLD_CFTC_POSITIONING: "Posisi CFTC Gold",
};

const MOVE_STRUCTURE_LABELS: Record<string, string> = {
  BTC_DERIVATIVES: "Derivatives BTC",
  BTC_SPOT_FLOW: "Partisipasi spot BTC",
  BTC_SPOT_ORDER_BOOK: "Order book spot BTC",
  BTC_PERP_ORDER_BOOK: "Order book perpetual BTC",
};

const MOVE_COMPLETENESS_LABELS: Record<string, string> = {
  EVIDENCE_COMPLETE: "LENGKAP",
  EVIDENCE_INCOMPLETE: "BELUM LENGKAP",
};

const BRIEFING_RESOLUTION_LABELS: Record<
  FactualMarketBriefing["resolution"]["status"],
  string
> = {
  MARKET_DATA_INSUFFICIENT: "DATA BELUM CUKUP",
  NO_MATERIAL_MOVE: "BELUM ADA PERGERAKAN MATERIAL",
  MATERIAL_MOVE_EVIDENCE_INCOMPLETE: "BUKTI BELUM LENGKAP",
  MATERIAL_MOVE_EVIDENCE_COMPLETE: "BUKTI LENGKAP",
};

const RATES_POLICY_LABELS: Record<string, string> = {
  DFII10: "Real yield AS 10 tahun",
  DTWEXBGS: "Broad USD Index",
  WRESBAL: "Reserve balances",
  SOFR_IORB_SPREAD: "Spread SOFR−IORB",
};

const CREDIT_CONDITIONS_LABELS: Record<string, string> = {
  BAMLH0A0HYM2: "US High Yield OAS",
  BAMLC0A0CM: "US Investment Grade OAS",
  VIXCLS: "VIX",
  NFCI: "Chicago Fed NFCI",
  ANFCI: "Chicago Fed Adjusted NFCI",
};

const RATES_POLICY_QUALITY_LABELS: Record<string, string> = {
  FRESH: "TERBARU SAAT DIPEROLEH",
  STALE: "SUDAH LAMA SAAT DIPEROLEH",
  PARTIAL: "DATA SEBAGIAN",
  UNKNOWN: "KUALITAS BELUM PASTI",
};

function liquidityBillions(value: number): string {
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} miliar USD`;
}

function liquidityChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Belum cukup riwayat";
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value)} miliar USD`;
}

function netLiquidityExplanation(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Belum cukup riwayat sekitar satu minggu untuk menjelaskan perubahan proxy.";
  }
  if (value > 0) {
    return "Proxy Net Liquidity meningkat. Secara aritmetika, aset Fed setelah dikurangi kas Treasury dan reverse repo lebih tinggi dibanding pembanding sekitar satu minggu. Ini menunjukkan likuiditas dolar yang lebih besar dalam proxy ini, bukan bukti dana langsung masuk ke Bitcoin dan bukan prediksi arah BTC.";
  }
  if (value < 0) {
    return "Proxy Net Liquidity menurun. Secara aritmetika, aset Fed setelah dikurangi kas Treasury dan reverse repo lebih rendah dibanding pembanding sekitar satu minggu. Ini menunjukkan likuiditas dolar yang lebih kecil dalam proxy ini, bukan bukti dana langsung keluar dari Bitcoin dan bukan prediksi arah BTC.";
  }
  return "Proxy Net Liquidity tidak berubah terhadap pembanding sekitar satu minggu. Proxy ini tetap hanya menggambarkan aritmetika Fed assets dikurangi TGA dan reverse repo, bukan arus langsung ke Bitcoin.";
}

/** Formatter khusus tampilan Bagian 05; nilai, basis, dan unit domain tidak diubah. */
function briefingMacroUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized.includes("billion") && (normalized.includes("dollar") || normalized.includes("usd"))) return "miliar USD";
  if (normalized.includes("million") && (normalized.includes("dollar") || normalized.includes("usd"))) return "juta USD";
  if (normalized.includes("thousand") && (normalized.includes("dollar") || normalized.includes("usd"))) return "ribu USD";
  if (normalized === "usd" || normalized === "dollars") return "USD";
  return unit;
}

function briefingMacroValue(value: string, unit: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const normalized = unit.trim().toLowerCase();
  if (normalized === "%" || normalized.includes("percent")) {
    return `${formatBriefingNumber(numeric, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }
  const shownUnit = briefingMacroUnit(unit);
  return `${formatBriefingNumber(numeric, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${shownUnit ? ` ${shownUnit}` : ""}`;
}

function briefingMacroDelta(value: number, unit: string): string {
  const shown = formatBriefingNumber(value, {
    minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero",
  });
  const normalized = unit.trim().toLowerCase();
  if (normalized === "%" || normalized.includes("percent")) return `${shown} poin persentase`;
  const shownUnit = briefingMacroUnit(unit);
  return `${shown}${shownUnit ? ` ${shownUnit}` : ""}`;
}

const MAX_MOVE_CATALYST_DETAILS = 3;

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateOnly(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function jurisdictionLabel(value: string | null): string {
  if (value === "US") return "AS";
  if (value === "CHINA") return "China";
  if (value === "JAPAN") return "Jepang";
  if (value === "EURO_AREA") return "Zona Euro";
  if (value === "UK") return "Inggris";
  if (value === "CANADA") return "Kanada";
  if (value === "AUSTRALIA") return "Australia";
  if (value === "GLOBAL") return "Global";
  return "Wilayah belum ditetapkan";
}

function expectationType(value: string): string {
  if (value === "CONSENSUS") return "konsensus";
  if (value === "OFFICIAL_PROJECTION") return "proyeksi resmi";
  return "perkiraan provider";
}

function surpriseRelation(value: string): string {
  if (value === "ABOVE_EXPECTATION") return "di atas perkiraan";
  if (value === "BELOW_EXPECTATION") return "di bawah perkiraan";
  return "sesuai perkiraan";
}

function repricingRole(value: string): string {
  if (value === "T_PLUS_5") return "5 menit";
  if (value === "T_PLUS_15") return "15 menit";
  if (value === "T_PLUS_30") return "30 menit";
  return "60 menit";
}

function repricingStatus(value: string): string {
  if (value === "REPRICING_OBSERVED") return "Move melewati threshold historis P90.";
  if (value === "NO_REPRICING_OBSERVED") return "Move belum melewati threshold historis P90.";
  if (value === "CONTAMINATED") return "Window tercampur event HIGH lain; hasil tidak dianggap clean.";
  return "Repricing belum dapat dinilai secara lengkap.";
}

function repricingResponseStatus(value: string): string {
  if (value === "REPRICED") return "melewati threshold";
  if (value === "BELOW_THRESHOLD") return "di bawah threshold";
  return "belum dapat dievaluasi";
}

function repricingDirection(value: string): string {
  if (value === "UP") return "naik";
  if (value === "DOWN") return "turun";
  if (value === "FLAT") return "datar";
  return "arah belum tersedia";
}

function percentMagnitude(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value) + "%";
}

function signedPercent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatBriefingPercent(value, digits);
}

function plainPercent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${formatBriefingNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function percentileLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `P${formatBriefingNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function synchronousCoverageLabel(value: string): string {
  if (value === "COMPLETE") return "TERSEDIA LENGKAP";
  if (value === "PARTIAL") return "TERSEDIA SEBAGIAN";
  return "DATA BELUM CUKUP";
}

function scheduledCatalystEvidenceLabel(coverage: string, count: number): string {
  if (coverage === "COMPLETE") {
    return count > 0 ? "TERSEDIA" : "TIDAK ADA DALAM WINDOW";
  }
  if (coverage === "BOUNDED_QUERY_LIMIT_REACHED") return "CAKUPAN TERBATAS";
  return "TIDAK TERSEDIA";
}

function unscheduledCatalystEvidenceLabel(coverage: string, count: number): string {
  if (coverage === "COMPLETE") {
    return count > 0 ? "TERSEDIA" : "TIDAK ADA KANDIDAT";
  }
  if (coverage === "PARTIAL") return "TERSEDIA SEBAGIAN";
  if (coverage === "BOUNDED_QUERY_LIMIT_REACHED") return "CAKUPAN TERBATAS";
  if (coverage === "EMPTY") return "BELUM ADA CAKUPAN DURABLE";
  return "TIDAK TERSEDIA";
}

function MarketMoveBriefingItem({
  item,
}: {
  item: FactualMarketBriefing["marketMoves"]["items"][number];
}) {
  const horizon = [...item.horizons].sort((a, b) => {
    const aMaterial = a.status === "MATERIAL_MOVE" ? 1 : 0;
    const bMaterial = b.status === "MATERIAL_MOVE" ? 1 : 0;
    return bMaterial - aMaterial || b.horizonMinutes - a.horizonMinutes;
  })[0] ?? null;
  const fingerprint = horizon
    ? item.evidence?.synchronousFingerprint.find(
        (candidate) => candidate.horizonMinutes === horizon.horizonMinutes,
      )
    : null;
  const spotFlow = item.evidence?.btcSpotFlow ?? null;
  const moveConfirmation = item.evidence?.confirmation?.status === "OK"
    ? item.evidence.confirmation
    : null;
  const scheduledCatalysts = item.evidence?.scheduledCatalysts.slice(0, MAX_MOVE_CATALYST_DETAILS) ?? [];
  const screenedNews = screenMoveCatalystTitles(item.evidence?.unscheduledCandidates ?? [], item.asset);
  const unscheduledCandidates = screenedNews.items.slice(0, MAX_MOVE_CATALYST_DETAILS);
  const presentation = presentMarketMove(item);
  const assetTitle = item.asset === "BTC" ? "Bitcoin (BTC)" : "Emas (berjangka COMEX)";

  return <div className="ux2-market-card">
    <KpiCard label={assetTitle}
      value={presentation.price}
      valueDetail={presentation.priceDetail}
      change={presentation.change}
      badge={presentation.badge ? <StatusBadge label={presentation.badge.label} tone={presentation.badge.tone} /> : null} />
    <p className="ux2-market-note">
      {item.observedAt
        ? `Observasi ${dateTime(item.observedAt)} WIB`
        : "Observasi tersimpan belum tersedia."}
    </p>
    <ChartCard title={`Perubahan intraday ${MOVE_ASSET_LABELS[item.asset]}`}
      description="Perbandingan perubahan pada 15, 30, 60, dan 120 menit; bukan riwayat harga."
      horizons={presentation.horizons} />
    <p className="ux2-market-note">
      Perubahan 24 jam dan perubahan intraday diukur pada rentang yang berbeda.
    </p>

    {item.horizons.length > 0 || item.evidence
      ? <details className="briefing-analysis-details">
          <summary>
            <div>
              <span>RINCIAN PERGERAKAN DAN BUKTI</span>
              <strong>{MOVE_ASSESSMENT_LABELS[item.status]}</strong>
            </div>
            <span>Buka rincian</span>
          </summary>
          <div className="briefing-analysis-body">
            {item.horizons.map((candidate) => <span key={candidate.horizonMinutes}>
              {candidate.horizonMinutes} menit · {signedPercent(candidate.signedPercentChange)}
              {" · "}{MOVE_HORIZON_LABELS[candidate.status] ?? "status belum tersedia"}
              {" · "}ambang {plainPercent(candidate.materialityThresholdPercent)}
              {" · "}{percentileLabel(candidate.targetPercentileRank)}
            </span>)}

            {fingerprint
              ? <span>
                  Lintas aset: {fingerprint.series.map((series) =>
                    `${MOVE_SERIES_LABELS[series.seriesKey] ?? series.seriesKey} ${series.state === "AVAILABLE_SYNCHRONOUS" ? signedPercent(series.signedPercentChange) : "—"}`
                  ).join(" · ")}
                  {" · "}cakupan {MOVE_COVERAGE_LABELS[fingerprint.coverage] ?? fingerprint.coverage}
                </span>
              : null}

            {item.evidence
              ? <>
                  <span>
                    Pemicu peristiwa dalam rentang pengamatan: {item.evidence.scheduledCatalystCount} peristiwa terjadwal
                    {" · "}cakupan {MOVE_COVERAGE_LABELS[item.evidence.scheduledCatalystCoverage] ?? "belum diketahui"}
                    {" · "}{item.evidence.unscheduledCandidateCount} kandidat berita tercatat
                    {" · "}cakupan berita {MOVE_COVERAGE_LABELS[item.evidence.unscheduledCatalystCoverage] ?? "belum diketahui"}
                  </span>
                  {scheduledCatalysts.map((event) => <span key={`${event.eventIdentityKey ?? event.eventId}:${event.retrievedAt}`}>
                    Peristiwa: {event.subject}
                    {" · "}{jurisdictionLabel(event.jurisdiction ?? null)}
                    {" · "}{dateTime(event.scheduledAt)} WIB
                    {" · "}{MOVE_IMPORTANCE_LABELS[event.importance] ?? "dampak belum ditetapkan"}
                    {" · "}sumber {event.sourceId}
                  </span>)}
                  {item.evidence.scheduledCatalystCount > scheduledCatalysts.length
                    ? <span>
                        +{item.evidence.scheduledCatalystCount - scheduledCatalysts.length} peristiwa terjadwal lain dalam rentang pengamatan.
                      </span>
                    : null}
                  {unscheduledCandidates.map((candidate) => <span key={candidate.url}>
                    Kandidat berita: {candidate.title}
                    {" · "}{candidate.domain}
                    {" · "}{candidate.providerDate
                      ? `${dateTime(candidate.providerDate)} WIB`
                      : `pertama diketahui ${dateTime(candidate.firstSeenRetrievedAt)} WIB`}
                    {" · "}{MOVE_TEMPORAL_FIT_LABELS[candidate.temporalFit] ?? "kecocokan waktu belum diketahui"}
                  </span>)}
                  {screenedNews.excludedTitleCount > 0
                    ? <span>{screenedNews.excludedTitleCount} judul promosi/topik lain tersaring dari tampilan.</span>
                    : null}
                  {item.evidence.unscheduledCandidateCount > 0 && screenedNews.items.length === 0
                    ? <span>Tidak ada judul yang ditampilkan setelah penyaringan; cakupan sumber berita tetap seperti tercatat.</span>
                    : null}
                  {screenedNews.items.length > unscheduledCandidates.length
                    ? <span>
                        +{screenedNews.items.length - unscheduledCandidates.length} kandidat berita lain untuk ditampilkan dalam rentang pengamatan.
                      </span>
                    : null}
                </>
              : null}

            {spotFlow
              ? <span>
                  Binance Spot: porsi pembelian taker {spotFlow.takerBuyShare === null ? "—" : plainPercent(spotFlow.takerBuyShare * 100, 1)}
                  {" · "}volume taker bersih {spotFlow.netTakerBaseVolumeBtc > 0 ? "+" : ""}
                  {spotFlow.netTakerBaseVolumeBtc.toLocaleString("id-ID", { maximumFractionDigits: 2 })} BTC
                  {" · "}cakupan {MOVE_COVERAGE_LABELS[spotFlow.coverage] ?? "belum diketahui"}
                </span>
              : null}

            {moveConfirmation
              ? <>
                  <span><strong>KESELARASAN BUKTI</strong> · {confirmationStatus(moveConfirmation.assessment.resolution)}</span>
                  <span>
                    {confirmationResolution(moveConfirmation.assessment.resolution)} Arah pergerakan: {moveConfirmation.targetDirection === "UP" ? "naik" : "turun"}.
                  </span>
                  {moveConfirmation.evidence.map((evidence) => <span key={`${evidence.evidenceClass}:${evidence.source}`}>
                    {confirmationSource(evidence.source)} · {confirmationJudgement(evidence.judgement)}
                  </span>)}
                  <span>Keselarasan ini bukan atribusi sebab-akibat.</span>
                </>
              : null}

            {item.evidence
              ? <>
                  <span><strong>STATUS BUKTI</strong></span>
                  <span>
                    Lintas pasar: {synchronousCoverageLabel(item.evidence.synchronousCoverage)}
                  </span>
                  <span>
                    Pemicu peristiwa terjadwal: {scheduledCatalystEvidenceLabel(
                      item.evidence.scheduledCatalystCoverage,
                      item.evidence.scheduledCatalystCount,
                    )}
                  </span>
                  <span>
                    Pemicu dari berita: {unscheduledCatalystEvidenceLabel(
                      item.evidence.unscheduledCatalystCoverage,
                      item.evidence.unscheduledCandidateCount,
                    )}
                  </span>
                  {item.evidence.slowBackground.items.map((background) => <span key={background.kind}>
                    {MOVE_BACKGROUND_LABELS[background.kind] ?? "Evidence latar belakang"}:{" "}
                    {MOVE_EVIDENCE_STATE_LABELS[background.state] ?? "STATUS BELUM PASTI"}
                  </span>)}
                  {item.evidence.cryptoMarketStructure?.components.map((component) => <span key={component.component}>
                    {MOVE_STRUCTURE_LABELS[component.component] ?? "Struktur pasar"}:{" "}
                    {MOVE_EVIDENCE_STATE_LABELS[component.state] ?? "STATUS BELUM PASTI"}
                  </span>)}
                  <span>
                    Suku bunga intraday: {MOVE_EVIDENCE_STATE_LABELS[item.evidence.intradayRatesPricing.state] ?? "STATUS BELUM PASTI"}
                    {" · "}kebijakan sumber gratis
                  </span>
                  <span>
                    Kelengkapan bukti keseluruhan: {MOVE_COMPLETENESS_LABELS[item.evidence.evidenceCompleteness] ?? "BELUM DINILAI"}
                  </span>
                </>
              : null}

            <span>Hubungan sebab-akibat belum dievaluasi.</span>
          </div>
        </details>
      : <span>Hubungan sebab-akibat belum dievaluasi.</span>}
  </div>;
}

function confirmationResolution(value: string): string {
  if (value === "CONFIRMING") return "Evidence independen mengonfirmasi.";
  if (value === "CONTRADICTING") return "Evidence independen bertentangan.";
  if (value === "MIXED") return "Evidence independen masih campuran.";
  return "Belum cukup evidence independen.";
}

function confirmationStatus(value: string): string {
  if (value === "CONFIRMING") return "MENGONFIRMASI";
  if (value === "CONTRADICTING") return "BERTENTANGAN";
  if (value === "MIXED") return "CAMPURAN";
  return "BELUM CUKUP EVIDENCE";
}

function confirmationJudgement(value: string | null): string {
  if (value === "SUPPORTING") return "mendukung";
  if (value === "CONTRADICTING") return "bertentangan";
  if (value === "NEUTRAL") return "netral";
  return "belum dapat dipakai";
}

function confirmationSource(value: string): string {
  if (value === "BTC_ETF_FLOW") return "Arus ETF Bitcoin AS";
  if (value === "BINANCE_SPOT_TAKER_FLOW") return "Binance Spot taker-flow";
  return value;
}

function pricingValue(value: number, unit: string | null): string {
  const normalized = unit?.trim().toLowerCase() ?? "";
  if (normalized === "usd" || normalized.includes("dollar")) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

type BriefingRatesPolicyPoint = FactualMarketBriefing["ratesPolicy"]["gold"][number];

function ratesPolicySigned(value: number, digits = 1): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  }).format(value);
}

function ratesPolicyValue(point: BriefingRatesPolicyPoint): string {
  if (point.valueUnit === "PERCENT") return `${formatBriefingNumber(point.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (point.valueUnit === "BPS") return formatBriefingBasisPoints(point.value, 1);
  if (point.valueUnit === "USD_BILLIONS") {
    return `${formatBriefingNumber(point.value, { maximumFractionDigits: 1 })} miliar USD`;
  }
  return formatBriefingNumber(point.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function ratesPolicyChangeValue(point: BriefingRatesPolicyPoint, value: number): string {
  if (point.changeUnit === "BPS") return formatBriefingBasisPoints(value, 1);
  if (point.changeUnit === "USD_BILLIONS") {
    return `${formatBriefingNumber(value, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    })} miliar USD`;
  }
  return formatBriefingPercent(value);
}

function ratesPolicyDirection(value: number | null): Direction {
  if (value === null) return "unknown";
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

function ratesPolicyPrimaryComparison(
  point: BriefingRatesPolicyPoint,
): { value: number; from: string; cadenceLabel: string } | null {
  if (point.cadence === "WEEKLY") {
    return point.change1w !== null && point.change1wFrom
      ? { value: point.change1w, from: point.change1wFrom, cadenceLabel: "observasi mingguan sebelumnya" }
      : null;
  }

  return point.change1d !== null && point.change1dFrom
    ? { value: point.change1d, from: point.change1dFrom, cadenceLabel: "observasi harian sebelumnya" }
    : null;
}

function ratesPolicyExplanation(point: BriefingRatesPolicyPoint, change: number | null): string {
  if (change === null) {
    return "Belum cukup riwayat qualified untuk menjelaskan perubahan terhadap observasi sebelumnya.";
  }

  if (point.seriesKey === "DFII10") {
    if (change > 0) {
      return "Real yield AS 10 tahun naik. Imbal hasil riil Treasury meningkat, sehingga opportunity cost memegang aset tanpa kupon seperti emas juga meningkat. Ini konteks, bukan prediksi arah Gold.";
    }
    if (change < 0) {
      return "Real yield AS 10 tahun turun. Imbal hasil riil Treasury menurun, sehingga opportunity cost memegang aset tanpa kupon seperti emas juga menurun. Ini konteks, bukan prediksi arah Gold.";
    }
    return "Real yield AS 10 tahun tidak berubah terhadap observasi sebelumnya.";
  }

  if (point.seriesKey === "DTWEXBGS") {
    if (change > 0) {
      return "Broad USD menguat terhadap keranjang mata uang mitra dagang. Ini menunjukkan kondisi dolar yang lebih kuat dan relevan sebagai konteks harga aset berdenominasi USD.";
    }
    if (change < 0) {
      return "Broad USD melemah terhadap keranjang mata uang mitra dagang. Ini menunjukkan kondisi dolar yang lebih lemah dan relevan sebagai konteks harga aset berdenominasi USD.";
    }
    return "Broad USD tidak berubah terhadap observasi sebelumnya.";
  }

  if (point.seriesKey === "WRESBAL") {
    if (change > 0) {
      return "Reserve balances bertambah dibanding rilis mingguan sebelumnya. Cadangan bank di Federal Reserve meningkat; ini konteks likuiditas sistem, bukan ukuran dana yang langsung masuk ke Bitcoin.";
    }
    if (change < 0) {
      return "Reserve balances berkurang dibanding rilis mingguan sebelumnya. Cadangan bank di Federal Reserve menurun; ini konteks likuiditas sistem, bukan ukuran dana yang langsung keluar dari Bitcoin.";
    }
    return "Reserve balances tidak berubah dibanding rilis mingguan sebelumnya.";
  }

  if (point.seriesKey === "SOFR_IORB_SPREAD") {
    if (change > 0) {
      return "Spread SOFR terhadap IORB melebar. Biaya funding overnight berjaminan bergerak lebih tinggi relatif terhadap bunga cadangan Fed; ini dapat menandai tekanan funding yang relatif lebih besar, tanpa menetapkan kondisi stress atau arah Bitcoin.";
    }
    if (change < 0) {
      return "Spread SOFR terhadap IORB menyempit. Biaya funding overnight berjaminan bergerak lebih dekat ke bunga cadangan Fed; ini menunjukkan tekanan relatif yang lebih kecil pada spread tersebut, tanpa menetapkan regime atau arah Bitcoin.";
    }
    return "Spread SOFR terhadap IORB tidak berubah terhadap observasi sebelumnya.";
  }

  return "Perubahan dicatat sebagai konteks faktual tanpa interpretasi arah pasar.";
}

function ratesPolicyShortExplanation(point: BriefingRatesPolicyPoint): string {
  if (point.seriesKey === "DFII10") return "Imbal hasil riil Treasury AS sebagai konteks harga emas.";
  if (point.seriesKey === "DTWEXBGS") return "Nilai dolar AS terhadap keranjang mata uang mitra dagang.";
  if (point.seriesKey === "WRESBAL") return "Saldo cadangan bank di Federal Reserve sebagai konteks likuiditas.";
  if (point.seriesKey === "SOFR_IORB_SPREAD") return "Selisih tingkat SOFR dan IORB sebagai konteks pendanaan overnight.";
  return "Perubahan indikator ini dicatat sebagai konteks faktual.";
}

function RatesPolicyBriefingCard({ point }: { point: BriefingRatesPolicyPoint }) {
  const comparison = ratesPolicyPrimaryComparison(point);
  const changeValue = comparison ? ratesPolicyChangeValue(point, comparison.value) : null;
  return <article className="briefing-rate-card">
    <KpiCard
      label={RATES_POLICY_LABELS[point.seriesKey] ?? point.seriesKey}
      value={ratesPolicyValue(point)}
      valueDetail={`Observasi ${dateOnly(point.observedAt)}`}
      change={comparison && changeValue
        ? {
            valueLabel: changeValue,
            direction: ratesPolicyDirection(comparison.value),
            comparisonLabel: `${comparison.cadenceLabel} · ${dateOnly(comparison.from)}`,
          }
        : null}
      badge={<StatusBadge
        label={RATES_POLICY_QUALITY_LABELS[point.quality] ?? "Kualitas data belum tersedia"}
        tone="neutral"
      />}
    />
    <p className="briefing-rate-meaning"><strong>Apa artinya:</strong> {ratesPolicyShortExplanation(point)}</p>
    <details className="briefing-rate-details">
      <summary>Baca penjelasan</summary>
      <p>{ratesPolicyExplanation(point, comparison?.value ?? null)}</p>
    </details>
  </article>;
}

type BriefingCreditConditionsPoint =
  FactualMarketBriefing["creditConditions"]["items"][number];

function primaryCreditConditionsChange(
  point: BriefingCreditConditionsPoint,
): BriefingCreditConditionsPoint["change1d"] {
  return point.cadence === "WEEKLY" ? point.change1w : point.change1d;
}

function creditConditionsValue(point: BriefingCreditConditionsPoint): string {
  const value = formatBriefingNumber(point.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return point.valueUnit === "PERCENT" ? `${value}%` : value;
}

function creditConditionsChangeValue(
  point: BriefingCreditConditionsPoint,
  change: BriefingCreditConditionsPoint["change1d"],
): string {
  if (change === null) return "tidak tersedia";
  if (point.changeUnit === "BPS") {
    return `${ratesPolicySigned(change.value, 1)} bps`;
  }
  return `${ratesPolicySigned(change.value, 2)} poin`;
}

function creditConditionsPreviousRelease(
  point: BriefingCreditConditionsPoint,
): string {
  const change = primaryCreditConditionsChange(point);
  const cadence = point.cadence === "WEEKLY" ? "mingguan" : "harian";
  if (change === null) return `observasi ${cadence} sebelumnya belum tersedia`;
  return `observasi ${cadence} sebelumnya ${creditConditionsChangeValue(point, change)} vs ${dateOnly(change.predecessorObservedAt)}`;
}

function creditConditionsExplanation(point: BriefingCreditConditionsPoint): string {
  const change = primaryCreditConditionsChange(point);
  if (change === null) {
    return "Belum cukup riwayat qualified untuk menjelaskan perubahan terhadap observasi sebelumnya.";
  }

  if (point.seriesKey === "BAMLH0A0HYM2") {
    if (change.value > 0) {
      return "Spread high-yield melebar. Investor meminta premi risiko lebih besar untuk utang berisiko, sehingga kondisi kredit high-yield menjadi lebih ketat dibanding observasi sebelumnya.";
    }
    if (change.value < 0) {
      return "Spread high-yield menyempit. Premi risiko yang diminta investor menurun, sehingga kondisi kredit high-yield menjadi lebih longgar dibanding observasi sebelumnya.";
    }
    return "Spread high-yield tidak berubah dibanding observasi sebelumnya.";
  }

  if (point.seriesKey === "BAMLC0A0CM") {
    if (change.value > 0) {
      return "Spread investment-grade melebar. Premi risiko kredit korporasi berkualitas tinggi meningkat dibanding observasi sebelumnya.";
    }
    if (change.value < 0) {
      return "Spread investment-grade menyempit. Premi risiko kredit korporasi berkualitas tinggi menurun dibanding observasi sebelumnya.";
    }
    return "Spread investment-grade tidak berubah dibanding observasi sebelumnya.";
  }

  if (point.seriesKey === "NFCI" || point.seriesKey === "ANFCI") {
    const context = point.seriesKey === "NFCI"
      ? "dibanding rata-rata historis kondisi keuangan AS"
      : "setelah penyesuaian terhadap kondisi ekonomi saat itu";
    const direction = change.value > 0
      ? "bergerak ke arah kondisi yang lebih ketat"
      : change.value < 0
        ? "bergerak ke arah kondisi yang lebih longgar"
        : "tidak berubah";
    return `${point.seriesKey} ${direction} ${context} dibanding observasi mingguan sebelumnya. Ini konteks mingguan, bukan bukti penyebab pergerakan Bitcoin atau Emas intraday.`;
  }

  if (change.value > 0) {
    return "VIX naik. Implied volatility saham AS meningkat dibanding observasi sebelumnya; ini menunjukkan ekspektasi volatilitas yang lebih tinggi, bukan penyebab langsung pergerakan Bitcoin atau Gold.";
  }
  if (change.value < 0) {
    return "VIX turun. Implied volatility saham AS menurun dibanding observasi sebelumnya; ini menunjukkan ekspektasi volatilitas yang lebih rendah, bukan penyebab langsung pergerakan Bitcoin atau Gold.";
  }
  return "VIX tidak berubah dibanding observasi sebelumnya.";
}

function CreditConditionsBriefingItem({
  point,
}: {
  point: BriefingCreditConditionsPoint;
}) {
  const change = primaryCreditConditionsChange(point);
  const shortExplanation = point.seriesKey === "BAMLH0A0HYM2"
    ? "Premi risiko obligasi korporasi AS berimbal hasil tinggi (HY OAS)."
    : point.seriesKey === "BAMLC0A0CM"
      ? "Premi risiko obligasi korporasi AS berperingkat investasi (IG OAS)."
      : point.seriesKey === "NFCI"
        ? "Indeks mingguan kondisi keuangan AS dari Federal Reserve Bank of Chicago."
        : point.seriesKey === "ANFCI"
          ? "Indeks mingguan kondisi keuangan AS setelah penyesuaian kondisi ekonomi."
          : "VIX adalah ukuran volatilitas tersirat opsi saham AS.";
  return <article className="briefing-rate-card">
    <KpiCard
      label={CREDIT_CONDITIONS_LABELS[point.seriesKey] ?? point.seriesKey}
      value={creditConditionsValue(point)}
      valueDetail={`Observasi ${dateOnly(point.observedAt)}`}
      change={change
        ? {
            valueLabel: creditConditionsChangeValue(point, change),
            direction: ratesPolicyDirection(change.value),
            comparisonLabel: `observasi ${point.cadence === "WEEKLY" ? "mingguan" : "harian"} sebelumnya · ${dateOnly(change.predecessorObservedAt)}`,
          }
        : null}
      badge={<StatusBadge
        label={RATES_POLICY_QUALITY_LABELS[point.acquisitionQuality] ?? "KUALITAS BELUM PASTI"}
        tone="neutral"
      />}
    />
    <p className="briefing-rate-meaning"><strong>Apa artinya:</strong> {shortExplanation}</p>
    <details className="briefing-rate-details">
      <summary>Baca penjelasan</summary>
      <p>Dibanding {creditConditionsPreviousRelease(point)}.</p>
      <p>{creditConditionsExplanation(point)}</p>
      <p>Data diperoleh {dateTime(point.retrievedAt)} WIB · sumber {point.sourceId}.</p>
    </details>
  </article>;
}

export function FactualMarketBriefingPanel({ data }: { data: FactualMarketBriefing }) {
  const moves = data.marketMoves;
  const ratesPolicy = data.ratesPolicy;
  const creditConditions = data.creditConditions;
  const netLiquidity = data.netLiquidity;
  const centralBankBalanceSheets = data.centralBankBalanceSheets;
  const centralBankAvailableCount = centralBankBalanceSheets.items.filter((item) => item.latest !== null).length;
  const changed = data.whatChanged;
  const baselines = data.eventBaselines;
  const surprises = data.eventSurprises;
  const repricing = data.eventRepricing;
  const confirmation = data.confirmation;
  const nextCatalyst = data.nextCatalyst;
  const resolution = data.resolution;

  return <section className="panel overview-change-layer" aria-labelledby="briefing-market-state-title">
    <div className="panel-label" style={{ fontSize: 12, gap: 12, flexWrap: "wrap" }}>
      <span>RINGKASAN PASAR</span>
      <span>
        {moves.evidenceStatus === "AVAILABLE"
          ? moves.materialMoveCount > 0
            ? `${moves.materialMoveCount} PERINGATAN PERGERAKAN`
            : "TANPA PERINGATAN PERGERAKAN"
          : ratesPolicy.evidenceStatus === "AVAILABLE"
              || netLiquidity.evidenceStatus === "AVAILABLE"
              || centralBankAvailableCount > 0
              || changed.evidenceStatus === "AVAILABLE"
            ? "KONTEKS MAKRO TERSEDIA"
            : "DATA BELUM CUKUP"}
      </span>
    </div>

    <nav className="briefing-flow" aria-label="Urutan baca Ringkasan Pasar">
      <a href="#briefing-market-state-title">
        <span style={{ fontSize: 12 }}>01 · PASAR SEKARANG</span>
        <strong style={{ fontSize: 12 }}>{moves.evidenceStatus === "AVAILABLE" ? "TERSEDIA" : "BELUM CUKUP"}</strong>
      </a>
      <a href="#briefing-rates-policy">
        <span>02 · RATES &amp; POLICY</span>
        <strong>{ratesPolicy.evidenceStatus === "AVAILABLE" ? "TERSEDIA" : "BELUM CUKUP"}</strong>
      </a>
      <a href="#briefing-usd-liquidity">
        <span>03 · LIKUIDITAS</span>
        <strong>{netLiquidity.evidenceStatus === "AVAILABLE" || centralBankAvailableCount > 0 ? "TERSEDIA" : "BELUM CUKUP"}</strong>
      </a>
      <a href="#briefing-credit-conditions">
        <span>04 · CREDIT</span>
        <strong>{creditConditions.evidenceStatus === "AVAILABLE" ? "TERSEDIA" : "BELUM CUKUP"}</strong>
      </a>
      <a href="#briefing-macro-background">
        <span>05 · LATAR MAKRO</span>
        <strong>{changed.evidenceStatus === "AVAILABLE" ? "TERSEDIA" : "BELUM CUKUP"}</strong>
      </a>
    </nav>

    <div className="ux2-market-current">
      <SectionHeader titleId="briefing-market-state-title" title="01 · Apa yang bergerak sekarang?"
        summary={marketCurrentSummary(moves)} />
      {moves.evidenceStatus === "AVAILABLE"
        ? <div className="ux2-market-grid">
            {moves.items.map((item) => <MarketMoveBriefingItem item={item} key={item.asset} />)}
          </div>
        : <div className="plain-notice">
            <strong>Data pemantauan pasar belum cukup</strong>
            <span>{moves.reason ?? "Data belum tersedia"}</span>
          </div>}
      {moves.evidenceStatus === "AVAILABLE" && moves.reason
        ? <div className="plain-notice">
            <strong>Cakupan sebagian</strong>
            <span>{moves.reason}</span>
          </div>
        : null}
    </div>

    <div className="briefing-analysis-section briefing-primary-step" style={{ marginTop: "1.25rem" }}>
      <SectionHeader
        titleId="briefing-rates-policy"
        title="02 · Apa konteks suku bunga dan kebijakan untuk Emas dan Bitcoin?"
        summary="Konteks Gold: Real yield AS 10 tahun dan Broad USD Index. Konteks Bitcoin: Reserve balances dan spread SOFR−IORB."
      />

      {ratesPolicy.evidenceStatus === "AVAILABLE"
        ? <div className="briefing-rates-content">
            <section className="briefing-rate-group" aria-label="Konteks Gold">
              <h3>Konteks Gold</h3>
              {ratesPolicy.gold.length
                ? <div className="briefing-rates-grid">
                    {ratesPolicy.gold.map((point) => <RatesPolicyBriefingCard key={point.seriesKey} point={point} />)}
                  </div>
                : <p>Real yield atau Broad USD Index belum tersedia.</p>}
            </section>
            <section className="briefing-rate-group" aria-label="Konteks Bitcoin">
              <h3>Konteks Bitcoin</h3>
              {ratesPolicy.bitcoin.length
                ? <div className="briefing-rates-grid">
                    {ratesPolicy.bitcoin.map((point) => <RatesPolicyBriefingCard key={point.seriesKey} point={point} />)}
                  </div>
                : <p>Reserve balances atau spread SOFR−IORB belum tersedia.</p>}
            </section>
            {ratesPolicy.reason
              ? <div className="plain-notice">
                  <strong>Cakupan sebagian</strong>
                  <span>{ratesPolicy.reason}</span>
                </div>
              : null}
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Rates & Policy belum cukup</strong>
            <span>{ratesPolicy.reason}</span>
          </div>}
    </div>

    <div className="briefing-analysis-section briefing-primary-step ux2-context-section" style={{ marginTop: "1.25rem" }}>
      <SectionHeader titleId="briefing-usd-liquidity"
        title="03 · Apa yang berubah pada likuiditas AS dan neraca bank sentral?"
        summary={netLiquidity.latest
          ? `Proxy Net Liquidity AS ${liquidityBillions(netLiquidity.latest.valueBillionsUsd)}; neraca ECB/BoJ tersedia ${centralBankAvailableCount} dari 2 seri.`
          : `Proxy Net Liquidity AS belum lengkap; neraca ECB/BoJ tersedia ${centralBankAvailableCount} dari 2 seri.`}
      />
      {netLiquidity.evidenceStatus === "AVAILABLE" && netLiquidity.latest
        ? <div className="briefing-rates-content">
            <div className="briefing-rates-grid">
              <div className="briefing-rate-card">
                <KpiCard label="Net Liquidity AS (proxy)"
                  value={liquidityBillions(netLiquidity.latest.valueBillionsUsd)}
                  valueDetail={`Observasi gabungan sampai ${dateOnly(netLiquidity.latest.asOf)}`}
                  change={netLiquidity.change1wBillionsUsd === null ? null : {
                    valueLabel: liquidityChange(netLiquidity.change1wBillionsUsd),
                    direction: ratesPolicyDirection(netLiquidity.change1wBillionsUsd),
                    comparisonLabel: netLiquidity.change1wFrom
                      ? `Dibanding sekitar 1 minggu · ${dateOnly(netLiquidity.change1wFrom)}`
                      : "Pembanding sekitar 1 minggu belum tersedia",
                  }}
                  badge={<StatusBadge
                    label={RATES_POLICY_QUALITY_LABELS[netLiquidity.latest.quality] ?? "KUALITAS BELUM PASTI"}
                    tone="neutral"
                  />}
                />
              </div>
            </div>
            <p className="briefing-rate-meaning"><strong>Apa artinya:</strong> Proxy aritmetika aset Fed dikurangi kas Treasury dan reverse repo; bukan arus dana langsung ke Bitcoin.</p>
            <div className="monitor-list" aria-label="Komponen proxy Net Liquidity">
              <div><strong>Aset Federal Reserve</strong><span>aset Fed {liquidityBillions(netLiquidity.latest.fedAssetsBillionsUsd)}</span></div>
              <div><strong>Kas Treasury</strong><span>kas Treasury {liquidityBillions(netLiquidity.latest.treasuryCashBillionsUsd)}</span></div>
              <div><strong>Reverse repo</strong><span>reverse repo {liquidityBillions(netLiquidity.latest.reverseRepoBillionsUsd)}</span></div>
            </div>
            <p className="briefing-rate-meaning">Perubahan masing-masing komponen tidak tersedia dalam read model ini; perubahan 1 minggu dan 4 minggu hanya untuk proxy gabungan.</p>
            <details className="briefing-rate-details">
              <summary>Baca penjelasan dan pembanding</summary>
              <p>Apa artinya: {netLiquidityExplanation(netLiquidity.change1wBillionsUsd)}</p>
              <p>Dibanding sekitar 1 minggu {liquidityChange(netLiquidity.change1wBillionsUsd)}
                {netLiquidity.change1wFrom ? ` vs data sampai ${dateOnly(netLiquidity.change1wFrom)}` : ""}</p>
              <p>Konteks sekitar 4 minggu: {liquidityChange(netLiquidity.change4wBillionsUsd)}
                {netLiquidity.change4wFrom ? ` vs data sampai ${dateOnly(netLiquidity.change4wFrom)}` : ""}</p>
              <p>kualitas komponen saat diperoleh: {RATES_POLICY_QUALITY_LABELS[netLiquidity.latest.quality] ?? "KUALITAS BELUM PASTI"}</p>
              <p>Proxy ini tidak mengukur arus dana langsung ke Bitcoin dan tidak menetapkan arah Bitcoin atau hubungan sebab-akibat.</p>
              {netLiquidity.reason ? <p>{netLiquidity.reason}</p> : null}
            </details>
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Net Liquidity belum cukup</strong>
            <span>{netLiquidity.reason}</span>
          </div>}
      <section className="briefing-rate-group" aria-label="Neraca bank sentral ECB dan BoJ" style={{ marginTop: "1.25rem" }}>
        <h3>Neraca bank sentral · Zona Euro dan Jepang</h3>
        <p className="briefing-rate-meaning">Data neraca ECB dan BoJ ditampilkan dalam mata uang serta skala aslinya, terpisah dari proxy Net Liquidity dolar AS.</p>
        <div className="briefing-rates-grid">
          {centralBankBalanceSheets.items.map((point) => <article className="briefing-rate-card" key={point.seriesKey}>
            <KpiCard
              label={point.label}
              value={point.latest ? `${formatBriefingNumber(point.latest.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${point.displayUnit}` : null}
              valueDetail={point.latest ? `Observasi ${dateOnly(point.latest.observedAt)} · ${point.cadence === "WEEKLY" ? "mingguan" : "bulanan"}` : null}
              change={point.changeFromPrevious !== null && point.previous
                ? {
                    valueLabel: `${formatBriefingNumber(point.changeFromPrevious, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" })} ${point.displayUnit}`,
                    direction: ratesPolicyDirection(point.changeFromPrevious),
                    comparisonLabel: `observasi ${point.cadence === "WEEKLY" ? "mingguan" : "bulanan"} sebelumnya · ${dateOnly(point.previous.observedAt)}`,
                  }
                : null}
              badge={point.status === "UNAVAILABLE"
                ? <StatusBadge label="BELUM DAPAT DIBACA" tone="unavailable" />
                : point.status === "MISSING"
                  ? <StatusBadge label="BELUM ADA DATA" tone="neutral" />
                  : null}
            />
            <p className="briefing-rate-meaning"><strong>Apa artinya:</strong> Level aset bank sentral ini adalah konteks kebijakan moneter, bukan arus dana langsung menuju BTC atau Emas.</p>
            {point.latest ? <details className="briefing-rate-details">
              <summary>Baca rincian observasi</summary>
              <p>Observasi ${dateOnly(point.latest.observedAt)}; data diperoleh ${dateTime(point.latest.retrievedAt)} WIB dari FRED.</p>
              <p>{point.previous
                ? `Dibanding observasi sebelumnya ${dateOnly(point.previous.observedAt)}; perubahan adalah selisih level dalam unit yang sama.`
                : "Riwayat observasi sebelumnya belum cukup untuk menghitung perubahan."}</p>
              <p>Tidak dikonversi ke USD dan tidak dimasukkan ke rumus Net Liquidity AS; hubungan sebab-akibat terhadap BTC/Emas tidak dievaluasi.</p>
            </details> : <p className="briefing-rate-meaning">Observasi tersimpan belum tersedia pada cutoff briefing.</p>}
          </article>)}
        </div>
      </section>
    </div>

    <div className="briefing-analysis-section briefing-primary-step ux2-context-section" style={{ marginTop: "1.25rem" }}>
      <SectionHeader titleId="briefing-credit-conditions"
        title="04 · Apa yang berubah pada kredit, volatilitas, dan kondisi keuangan?"
        summary={creditConditions.evidenceStatus === "AVAILABLE"
          ? `${creditConditions.items.length} indikator kredit, volatilitas, dan kondisi keuangan tersedia sesuai cakupan data.`
          : "Data kredit, volatilitas, dan kondisi keuangan belum cukup untuk ringkasan ini."}
      />
      {creditConditions.evidenceStatus === "AVAILABLE"
        ? <div className="briefing-rates-content">
            <div className="briefing-rates-grid">
              {creditConditions.items.map((point) =>
                <CreditConditionsBriefingItem key={point.seriesKey} point={point} />
              )}
            </div>
            {creditConditions.reason
              ? <div className="plain-notice">
                  <strong>Cakupan sebagian</strong>
                  <span>{creditConditions.reason}</span>
                </div>
              : null}
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Kredit dan kondisi finansial belum cukup</strong>
            <span>{creditConditions.reason}</span>
          </div>}
    </div>

    <div className="briefing-analysis-section briefing-primary-step ux2-context-section" style={{ marginTop: "1.25rem" }}>
      <SectionHeader titleId="briefing-macro-background"
        title="05 · Apa yang berubah pada latar makro?"
        summary={changed.evidenceStatus === "AVAILABLE"
          ? `${changed.items.length} seri makro memiliki nilai observasi dan baseline faktual yang dapat dibandingkan.`
          : "Nilai makro dengan baseline faktual belum cukup untuk ditampilkan."}
      />
      {changed.evidenceStatus === "AVAILABLE"
        ? <div className="briefing-rates-content">
            <div className="briefing-rates-grid">
              {changed.items.map((item) =>
                <article className="briefing-rate-card" key={item.seriesId}>
                  <KpiCard
                    label={SERIES_LABELS[item.seriesId] ?? item.subject}
                    value={briefingMacroValue(item.currentValue, item.unit)}
                    valueDetail={`Observasi ${dateOnly(item.currentObservedAt)}`}
                    change={{
                      valueLabel: briefingMacroDelta(item.changeValue, item.unit),
                      direction: ratesPolicyDirection(item.changeValue),
                      comparisonLabel: `baseline ${briefingMacroValue(item.baselineValue, item.unit)} · ${dateOnly(item.baselineObservedAt)}`,
                    }}
                  />
                  <p className="briefing-rate-meaning"><strong>Apa artinya:</strong> Perubahan terhadap baseline faktual tersimpan; bukan kesimpulan sebab-akibat.</p>
                  <details className="briefing-rate-details">
                    <summary>Baca rincian observasi</summary>
                    <p>Nilai terkini {briefingMacroValue(item.currentValue, item.unit)} pada {dateOnly(item.currentObservedAt)}.</p>
                    <p>Nilai pembanding {briefingMacroValue(item.baselineValue, item.unit)} pada {dateOnly(item.baselineObservedAt)}.</p>
                    <p>Perubahan {briefingMacroDelta(item.changeValue, item.unit)} · sumber {item.sourceId}.</p>
                  </details>
                </article>
              )}
            </div>
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Data makro belum cukup</strong>
            <span>{changed.reason}</span>
          </div>}
    </div>

    <details className="briefing-analysis-details">
      <summary>
        <div>
          <span>ANALISIS EVENT · DETAIL</span>
          <strong>Baseline, surprise, repricing & konfirmasi</strong>
        </div>
        <span>Buka detail</span>
      </summary>
      <div className="briefing-analysis-body">
        <div className="briefing-analysis-section">
          <div className="panel-label">
            <span>SEBELUM RILIS EVENT TERBARU</span>
        <span>{baselines.evidenceStatus === "AVAILABLE" ? "BASELINE TERSEDIA" : "BASELINE BELUM CUKUP"}</span>
      </div>
      <h3 style={{ margin: ".45rem 0 0" }}>Apa yang sudah diketahui sebelum rilis?</h3>
      <p className="lead-copy">Ekspektasi dan harga baseline diambil dari snapshot PRE yang sudah tersimpan. Section baseline ini sendiri tidak menyimpulkan repricing atau materialitas.</p>

      {baselines.evidenceStatus === "AVAILABLE"
        ? <div style={{ display: "grid", gap: ".85rem", marginTop: "1rem" }}>
            {baselines.events.map((event) => <div className="plain-notice" key={event.eventIdentityKey}>
              <strong>{event.subject}</strong>
              <span>{event.jurisdiction} · rilis {dateTime(event.releaseAt)} WIB · snapshot PRE {dateTime(event.preCapturedAt)} WIB</span>
              {event.expectation
                ? <span>
                    Baseline {expectationType(event.expectation.expectedType)}: {formatEventResultValue(event.expectation.expected, event.expectation.unit)}
                    {" · "}periode {event.expectation.period}
                  </span>
                : <span>Baseline ekspektasi yang memenuhi syarat belum tersedia.</span>}
              {event.pricing.length > 0
                ? <span>
                    Harga baseline: {event.pricing.map((item) =>
                      `${PRICING_LABELS[item.seriesKey] ?? item.seriesKey} ${pricingValue(item.value, item.unit)}`
                    ).join(" · ")}
                  </span>
                : <span>Baseline harga yang memenuhi syarat belum tersedia.</span>}
            </div>)}
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Baseline belum cukup</strong>
            <span>{baselines.reason}</span>
          </div>}
    </div>

        <div className="briefing-analysis-section">
          <div className="panel-label">
            <span>HASIL VS EKSPEKTASI</span>
        <span>{surprises.evidenceStatus === "AVAILABLE" ? "PERBANDINGAN TERSEDIA" : "DATA BELUM CUKUP"}</span>
      </div>
      <h3 style={{ margin: ".45rem 0 0" }}>Bagaimana hasil rilis dibanding perkiraan?</h3>
      <p className="lead-copy">Perbandingan faktual ini memakai SUR-001 yang sudah ada. Bagian ini belum menilai materialitas atau repricing pasar.</p>

      {surprises.evidenceStatus === "AVAILABLE"
        ? <div style={{ display: "grid", gap: ".85rem", marginTop: "1rem" }}>
            {surprises.events.map((event) => <div className="plain-notice" key={event.eventIdentityKey}>
              <strong>{event.subject}</strong>
              <span>{event.jurisdiction} · rilis {dateTime(event.releaseAt)} WIB</span>
              <span>
                Aktual {formatEventResultValue(event.actual, event.unit)}
                {" · "}perkiraan {formatEventResultValue(event.expected, event.unit)}
                {" · "}{surpriseRelation(event.relation)}
              </span>
            </div>)}
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Perbandingan belum cukup</strong>
            <span>{surprises.reason}</span>
          </div>}
    </div>

        <div className="briefing-analysis-section">
          <div className="panel-label">
            <span>REPRICING PASCA-RILIS</span>
        <span>{repricing.evidenceStatus === "AVAILABLE" ? "EVIDENCE TERSEDIA" : "DATA BELUM CUKUP"}</span>
      </div>
      <h3 style={{ margin: ".45rem 0 0" }}>Apakah move pasar cukup besar dibanding riwayat?</h3>
      <p className="lead-copy">RPR-001 membandingkan move PRE ke post-event dengan threshold P90 RPR-002B. Threshold production saat ini hanya tersedia untuk Bitcoin dan DXY pada horizon Observation yang cocok persis; hasil ini tidak membuktikan event menyebabkan move.</p>

      {repricing.evidenceStatus === "AVAILABLE"
        ? <div style={{ display: "grid", gap: ".85rem", marginTop: "1rem" }}>
            {repricing.events.map((event) => <div className="plain-notice" key={event.eventIdentityKey}>
              <strong>{event.subject}</strong>
              <span>
                {event.jurisdiction} · window {repricingRole(event.role)}
                {" · "}snapshot {dateTime(event.capturedAt)} WIB
              </span>
              <span>{repricingStatus(event.status)}</span>
              {event.responses.map((response) => <span key={response.observationKey}>
                {PRICING_LABELS[response.seriesKey] ?? response.seriesKey}:{" "}
                {response.measuredMagnitude === null
                  ? "magnitude belum tersedia"
                  : repricingDirection(response.direction) + " " + percentMagnitude(response.measuredMagnitude)}
                {" · "}threshold {percentMagnitude(response.minimumMagnitude)}
                {" · "}{repricingResponseStatus(response.status)}
              </span>)}
              {event.contaminationStatus === "CONTAMINATED"
                ? <span>Ada event HIGH lain di dalam window ini; evidence tidak diperlakukan sebagai clean attribution.</span>
                : null}
              <span>Hubungan sebab-akibat belum dievaluasi.</span>
            </div>)}
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Repricing belum cukup</strong>
            <span>{repricing.reason}</span>
          </div>}
    </div>

        <div className="briefing-analysis-section">
          <div className="panel-label">
            <span>KONFIRMASI / KONTRADIKSI</span>
        <span>
          {confirmation.item
            ? confirmationStatus(confirmation.item.resolution)
            : "DATA BELUM CUKUP"}
        </span>
      </div>
      <h3 style={{ margin: ".45rem 0 0" }}>Apakah evidence independen mendukung respons BTC ini?</h3>
      <p className="lead-copy">CONF-001A hanya menggabungkan evidence yang sudah memiliki methodology sendiri. Untuk saat ini baru arus ETF Bitcoin yang qualified; minimal dua kelas evidence independen dibutuhkan sebelum sistem boleh menyebut respons terkonfirmasi atau terkontradiksi.</p>

      {confirmation.evidenceStatus === "AVAILABLE" && confirmation.item
        ? <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>{confirmation.item.subject}</strong>
            <span>
              BTC {confirmation.item.targetDirection === "UP" ? "naik" : "turun"}
              {" · "}window {repricingRole(confirmation.item.role)}
              {" · "}cutoff evidence {dateTime(confirmation.item.capturedAt)} WIB
            </span>
            <span>{confirmationResolution(confirmation.item.resolution)}</span>
            {confirmation.item.evidence.map((item) => <span key={item.source}>
              {confirmationSource(item.source)}:{" "}
              {item.status === "QUALIFIED"
                ? confirmationJudgement(item.judgement)
                : "belum dapat dipakai"}
              {item.observedAt
                ? " · fakta " + dateTime(item.observedAt) + " WIB"
                : ""}
            </span>)}
            <span>
              Kelas directional yang tersedia {confirmation.item.directionalClassCount}
              {" / "}minimal {confirmation.item.minimumDirectionalClasses}.
            </span>
            <span>Hubungan sebab-akibat belum dievaluasi.</span>
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Belum cukup evidence</strong>
            <span>{confirmation.reason}</span>
          </div>}
    </div>

      </div>
    </details>

    <div className="briefing-next-catalyst">
      <div className="panel-label">
        <span>BERIKUTNYA DIPANTAU</span>
        <span>{nextCatalyst.evidenceStatus === "AVAILABLE" ? "EVENT BERIKUTNYA" : "BELUM ADA EVENT"}</span>
      </div>
      <h3 style={{ margin: ".45rem 0 0" }}>Apa yang perlu dipantau berikutnya?</h3>
      <p className="lead-copy">Bagian ini hanya menunjukkan jadwal event HIGH berikutnya dari data durable yang sudah dimuat. P365 belum menyimpulkan arah dampak pasar atau tindakan trading dari jadwal ini.</p>

      {nextCatalyst.evidenceStatus === "AVAILABLE" && nextCatalyst.slot
        ? <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>
              {nextCatalyst.slot.precision === "DATE_ONLY"
                ? dateOnly(nextCatalyst.slot.scheduledAt)
                : dateTime(nextCatalyst.slot.scheduledAt) + " WIB"}
            </strong>
            {nextCatalyst.slot.precision === "DATE_ONLY"
              ? <span>Jam belum ditetapkan oleh sumber ini.</span>
              : null}
            {nextCatalyst.slot.events.map((event) => <span key={event.eventIdentityKey}>
              {event.subject} · {jurisdictionLabel(event.jurisdiction)}
            </span>)}
          </div>
        : <div className="plain-notice" style={{ marginTop: "1rem" }}>
            <strong>Belum ada event berikutnya</strong>
            <span>{nextCatalyst.reason}</span>
          </div>}
    </div>

    <div className="briefing-next-catalyst">
      <div className="panel-label">
        <span>KESIMPULAN BRIEFING</span>
        <span>{BRIEFING_RESOLUTION_LABELS[resolution.status]}</span>
      </div>
      <h3 style={{ margin: ".45rem 0 0" }}>Apa kesimpulan faktual saat ini?</h3>
      <p className="lead-copy">
        Kesimpulan ini hanya merangkum status pergerakan dan kelengkapan bukti yang sudah tersedia.
        Ia tidak menetapkan penyebab, regime, atau tindakan trading.
      </p>
      <div className="plain-notice" style={{ marginTop: "1rem" }}>
        <strong>{BRIEFING_RESOLUTION_LABELS[resolution.status]}</strong>
        <span>{resolution.statement}</span>
        <span>{resolution.driverStatement}</span>
        <span>{resolution.watchStatement}</span>
      </div>
    </div>

    <div className="briefing-boundary-note">
      <strong>Boundary</strong>
      <span>Briefing tetap faktual. Transmisi lintas aset, regime, invalidation, prediksi, dan arah trading belum disimpulkan.</span>
    </div>
    <p className="decision-meta">Cutoff briefing {dateTime(data.asOf)} WIB</p>
  </section>;
}

"use client";

import type { FactualMarketBriefing } from "@/lib/application/factual-market-briefing";
import {
  formatMacroDisplayDelta,
  formatMacroDisplayValue,
} from "@/lib/presentation/macro-display";
import { formatEventResultValue } from "@/lib/presentation/intraday-event-response";

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
  MATERIAL_MOVE: "GERAKAN MATERIAL",
  BELOW_MATERIALITY_THRESHOLD: "DI BAWAH AMBANG",
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
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function plainPercent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function percentileLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `P${value.toFixed(1)}`;
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
  const scheduledCatalysts = item.evidence?.scheduledCatalysts.slice(0, MAX_MOVE_CATALYST_DETAILS) ?? [];
  const unscheduledCandidates = item.evidence?.unscheduledCandidates.slice(0, MAX_MOVE_CATALYST_DETAILS) ?? [];

  return <div className="plain-notice">
    <strong>
      {MOVE_ASSET_LABELS[item.asset]} · {MOVE_ASSESSMENT_LABELS[item.status]}
    </strong>
    <span>
      {item.observedAt
        ? `Observasi ${dateTime(item.observedAt)} WIB`
        : "Observasi durable belum tersedia."}
    </span>
    {horizon
      ? <span>
          {horizon.horizonMinutes} menit · {signedPercent(horizon.signedPercentChange)}
          {" · "}{MOVE_HORIZON_LABELS[horizon.status] ?? "status belum tersedia"}
          {" · "}ambang {plainPercent(horizon.materialityThresholdPercent)}
          {" · "}{percentileLabel(horizon.targetPercentileRank)}
        </span>
      : null}
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
            Catalyst dalam window: {item.evidence.scheduledCatalystCount} event terjadwal
            {" · "}cakupan {MOVE_COVERAGE_LABELS[item.evidence.scheduledCatalystCoverage] ?? "belum diketahui"}
            {" · "}{item.evidence.unscheduledCandidateCount} kandidat berita
            {" · "}cakupan berita {MOVE_COVERAGE_LABELS[item.evidence.unscheduledCatalystCoverage] ?? "belum diketahui"}
          </span>
          {scheduledCatalysts.map((event) => <span key={`${event.eventIdentityKey ?? event.eventId}:${event.retrievedAt}`}>
            Event: {event.subject}
            {" · "}{jurisdictionLabel(event.jurisdiction ?? null)}
            {" · "}{dateTime(event.scheduledAt)} WIB
            {" · "}{MOVE_IMPORTANCE_LABELS[event.importance] ?? "dampak belum ditetapkan"}
            {" · "}sumber {event.sourceId}
          </span>)}
          {item.evidence.scheduledCatalystCount > scheduledCatalysts.length
            ? <span>
                +{item.evidence.scheduledCatalystCount - scheduledCatalysts.length} event terjadwal lain dalam window.
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
          {item.evidence.unscheduledCandidateCount > unscheduledCandidates.length
            ? <span>
                +{item.evidence.unscheduledCandidateCount - unscheduledCandidates.length} kandidat berita lain dalam window.
              </span>
            : null}
        </>
      : null}
    {spotFlow
      ? <span>
          Binance Spot: buy share {spotFlow.takerBuyShare === null ? "—" : plainPercent(spotFlow.takerBuyShare * 100, 1)}
          {" · "}net taker {spotFlow.netTakerBaseVolumeBtc > 0 ? "+" : ""}
          {spotFlow.netTakerBaseVolumeBtc.toLocaleString("id-ID", { maximumFractionDigits: 2 })} BTC
          {" · "}cakupan {MOVE_COVERAGE_LABELS[spotFlow.coverage] ?? "belum diketahui"}
        </span>
      : null}
    {item.evidence
      ? <>
          <span><strong>STATUS EVIDENCE</strong></span>
          <span>
            Lintas pasar: {synchronousCoverageLabel(item.evidence.synchronousCoverage)}
          </span>
          <span>
            Catalyst terjadwal: {scheduledCatalystEvidenceLabel(
              item.evidence.scheduledCatalystCoverage,
              item.evidence.scheduledCatalystCount,
            )}
          </span>
          <span>
            Catalyst berita: {unscheduledCatalystEvidenceLabel(
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
            Rates intraday: {MOVE_EVIDENCE_STATE_LABELS[item.evidence.intradayRatesPricing.state] ?? "STATUS BELUM PASTI"}
            {" · "}kebijakan sumber gratis
          </span>
          <span>
            Keseluruhan evidence: {MOVE_COMPLETENESS_LABELS[item.evidence.evidenceCompleteness] ?? "BELUM DINILAI"}
          </span>
        </>
      : null}
    <span>Hubungan sebab-akibat belum dievaluasi.</span>
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

export function FactualMarketBriefingPanel({ data }: { data: FactualMarketBriefing }) {
  const moves = data.marketMoves;
  const changed = data.whatChanged;
  const baselines = data.eventBaselines;
  const surprises = data.eventSurprises;
  const repricing = data.eventRepricing;
  const confirmation = data.confirmation;
  const nextCatalyst = data.nextCatalyst;
  const resolution = data.resolution;

  return <section className="panel overview-change-layer" aria-labelledby="briefing-market-state-title">
    <div className="panel-label">
      <span>MARKET BRIEFING</span>
      <span>
        {moves.evidenceStatus === "AVAILABLE"
          ? `${moves.materialMoveCount} GERAKAN MATERIAL`
          : changed.evidenceStatus === "AVAILABLE"
            ? "KONTEKS MAKRO TERSEDIA"
            : "DATA BELUM CUKUP"}
      </span>
    </div>

    <div className="change-layer-grid">
      <div>
        <h2 id="briefing-market-state-title">Apa yang bergerak sekarang?</h2>
        <p className="lead-copy">
          BTC dan Gold dinilai lebih dulu terhadap ambang historis 15/30/60/120 menit.
          Cross-asset, catalyst, dan spot participation hanya ditampilkan dari evidence yang
          sudah tersedia pada cutoff; tidak ada atribusi sebab-akibat.
        </p>
      </div>
    </div>

    {moves.evidenceStatus === "AVAILABLE"
      ? <div style={{ display: "grid", gap: ".75rem", marginTop: "1rem" }}>
          {moves.items.map((item) => <MarketMoveBriefingItem item={item} key={item.asset} />)}
          {moves.reason
            ? <div className="plain-notice">
                <strong>Cakupan sebagian</strong>
                <span>{moves.reason}</span>
              </div>
            : null}
        </div>
      : <div className="plain-notice" style={{ marginTop: "1rem" }}>
          <strong>Assessment market belum cukup</strong>
          <span>{moves.reason}</span>
        </div>}

    <div className="briefing-analysis-section" style={{ marginTop: "1.25rem" }}>
      <div className="panel-label">
        <span>LATAR MAKRO</span>
        <span>{changed.evidenceStatus === "AVAILABLE" ? "DATA TERSEDIA" : "DATA BELUM CUKUP"}</span>
      </div>
      <h3 style={{ margin: ".45rem 0 0" }}>Apa yang berubah di konteks makro?</h3>
      <p className="lead-copy">
        Ringkasan baseline faktual Macro yang sudah tersedia. Bagian ini tidak mengubah
        pergerakan bersama menjadi klaim transmisi atau penyebab.
      </p>

      {changed.evidenceStatus === "AVAILABLE"
        ? <div className="monitor-list" style={{ marginTop: "1rem" }}>
            {changed.items.map((item) => <div key={item.seriesId}>
              <strong>{SERIES_LABELS[item.seriesId] ?? item.subject}</strong>
              <span>
                Saat ini {formatMacroDisplayValue(item.currentValue, item.unit)}
                {" · "}sebelumnya {formatMacroDisplayValue(item.baselineValue, item.unit)}
                {" · "}{formatMacroDisplayDelta(item.changeValue, item.unit)}
              </span>
            </div>)}
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

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
  const changed = data.whatChanged;
  const baselines = data.eventBaselines;
  const surprises = data.eventSurprises;
  const repricing = data.eventRepricing;
  const confirmation = data.confirmation;
  const nextCatalyst = data.nextCatalyst;

  return <section className="panel overview-change-layer" aria-labelledby="briefing-what-changed-title">
    <div className="panel-label">
      <span>MARKET BRIEFING</span>
      <span>{changed.evidenceStatus === "AVAILABLE" ? "DATA TERSEDIA" : "DATA BELUM CUKUP"}</span>
    </div>
    <div className="change-layer-grid">
      <div>
        <h2 id="briefing-what-changed-title">Apa yang berubah?</h2>
        <p className="lead-copy">Ringkasan baseline faktual Macro yang sudah tersedia di dashboard. Bagian ini hanya menyatukan data yang sudah ada dan tidak menambah kesimpulan baru.</p>
      </div>
    </div>

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
          <strong>Data belum cukup</strong>
          <span>{changed.reason}</span>
        </div>}

    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
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

    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
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

    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
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

    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
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

    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
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

    <div className="plain-notice" style={{ marginTop: "1rem" }}>
      <strong>Penalaran lanjutan masih dibatasi</strong>
      <span>Briefing sekarang menilai factual change, baseline, surprise faktual, repricing historis, confirmation evidence yang sudah qualified, dan event berikutnya yang perlu dipantau. Transmisi lintas aset, regime, invalidation, prediksi, dan arah trading belum disimpulkan.</span>
    </div>
    <p className="decision-meta">Cutoff briefing {dateTime(data.asOf)} WIB</p>
  </section>;
}

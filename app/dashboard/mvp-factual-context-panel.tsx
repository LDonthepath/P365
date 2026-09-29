"use client";

import type {
  FactualMarketChange,
  FactualMarketSeries,
  MacroCryptoGoldFactualContext,
} from "@/lib/application/mvp-factual-context";
import type { NetLiquidityReadModel } from "@/lib/application/net-liquidity";
import type { RatesSeriesPoint } from "@/lib/application/rates-inflation";
import type { DataQuality } from "@/lib/domain/types";

const RATE_LABELS: Record<RatesSeriesPoint["seriesKey"], string> = {
  DGS2: "Treasury 2 tahun",
  DGS10: "Treasury 10 tahun",
  DFII10: "Real yield 10 tahun",
  T10YIE: "Breakeven 10 tahun",
  T10Y2Y: "Kurva 10Y–2Y",
};

const QUALITY_LABELS: Record<DataQuality, string> = {
  FRESH: "TERBARU SAAT DIPEROLEH",
  STALE: "SUDAH LAMA SAAT DIPEROLEH",
  PARTIAL: "DATA SEBAGIAN",
  UNKNOWN: "KUALITAS TIDAK DIKETAHUI",
};

const RECENCY_LABELS: Record<"CURRENT" | "STALE" | "UNKNOWN", string> = {
  CURRENT: "TERKINI",
  STALE: "SUDAH LAMA",
  UNKNOWN: "STATUS WAKTU TIDAK DIKETAHUI",
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

function date(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1_000 ? 0 : 2,
  }).format(value);
}

function indexValue(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number): string {
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value)}%`;
}

function bps(value: number | null): string {
  if (value === null) return "Belum cukup riwayat";
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value)} bps`;
}

function marketChange(change: FactualMarketChange | null): string {
  if (!change) return "Belum cukup riwayat";
  return change.percentChange === null ? "Persentase tidak tersedia" : percent(change.percentChange);
}

function MarketHorizon({ label, change }: { label: string; change: FactualMarketChange | null }) {
  return <div className="factual-horizon">
    <span>{label}</span>
    <strong>{marketChange(change)}</strong>
    <small>{change ? `dibanding observasi ${dateTime(change.predecessorObservedAt)}` : "Tidak ada observasi pada atau sebelum target"}</small>
  </div>;
}

function MarketCard({
  label,
  series,
  valueKind,
}: {
  label: string;
  series: FactualMarketSeries;
  valueKind: "MONEY" | "INDEX";
}) {
  if (series.status === "UNAVAILABLE") {
    return <article className="factual-metric-card">
      <div className="factual-card-head"><span>{label}</span><span>TIDAK TERSEDIA</span></div>
      <strong className="factual-primary-value">—</strong>
      <p className="muted">{series.reason}</p>
    </article>;
  }

  return <article className="factual-metric-card">
    <div className="factual-card-head"><span>{label}</span><span>{RECENCY_LABELS[series.recency]}</span></div>
    <strong className="factual-primary-value">{valueKind === "MONEY" ? money(series.latestValue) : indexValue(series.latestValue)}</strong>
    <p className="factual-trace">Observasi {dateTime(series.latestObservedAt)} · diperoleh {dateTime(series.latestRetrievedAt)}</p>
    <div className="factual-horizons">
      <MarketHorizon label="1 HARI" change={series.change1d} />
      <MarketHorizon label="1 MINGGU" change={series.change1w} />
      <MarketHorizon label="4 MINGGU" change={series.change4w} />
    </div>
    <p className="factual-acquisition-note">Kualitas saat akuisisi: {QUALITY_LABELS[series.acquisitionQuality]}. Status waktu di atas dihitung ulang pada cutoff tampilan.</p>
  </article>;
}

function RateCard({ point }: { point: RatesSeriesPoint }) {
  return <article className="factual-metric-card compact">
    <div className="factual-card-head"><span>{RATE_LABELS[point.seriesKey]}</span><span>{QUALITY_LABELS[point.quality]}</span></div>
    <strong className="factual-primary-value">{indexValue(point.valuePercent)}%</strong>
    <p className="factual-trace">Observasi {dateTime(point.observedAt)}</p>
    <div className="factual-horizons two">
      <div className="factual-horizon"><span>1 MINGGU</span><strong>{bps(point.change1wBps)}</strong><small>{point.change1wFrom ? `dibanding ${date(point.change1wFrom)}` : "Belum cukup riwayat"}</small></div>
      <div className="factual-horizon"><span>4 MINGGU</span><strong>{bps(point.change4wBps)}</strong><small>{point.change4wFrom ? `dibanding ${date(point.change4wFrom)}` : "Belum cukup riwayat"}</small></div>
    </div>
  </article>;
}

function liquidityChange(value: number | null): string {
  if (value === null) return "Belum cukup riwayat";
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value)} miliar USD`;
}

function NetLiquidityCard({ data }: { data: NetLiquidityReadModel }) {
  if (data.status === "UNAVAILABLE") {
    return <article className="factual-metric-card compact"><div className="factual-card-head"><span>Likuiditas bersih</span><span>TIDAK TERSEDIA</span></div><strong className="factual-primary-value">—</strong><p className="muted">{data.reason}</p></article>;
  }
  return <article className="factual-metric-card compact">
    <div className="factual-card-head"><span>Likuiditas bersih</span><span>PROXY FAKTUAL</span></div>
    <strong className="factual-primary-value">{new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(data.latest.valueBillionsUsd)} miliar USD</strong>
    <p className="factual-trace">Observasi komponen terakhir {dateTime(data.latest.asOf)}</p>
    <div className="factual-horizons two">
      <div className="factual-horizon"><span>1 MINGGU</span><strong>{liquidityChange(data.change1wBillionsUsd)}</strong><small>{data.change1wFrom ? `dibanding ${date(data.change1wFrom)}` : "Belum cukup riwayat"}</small></div>
      <div className="factual-horizon"><span>4 MINGGU</span><strong>{liquidityChange(data.change4wBillionsUsd)}</strong><small>{data.change4wFrom ? `dibanding ${date(data.change4wFrom)}` : "Belum cukup riwayat"}</small></div>
    </div>
  </article>;
}

export function MvpFactualContextPanel({ data }: { data: MacroCryptoGoldFactualContext }) {
  const rates = data.macro.ratesInflation.status === "OK"
    ? data.macro.ratesInflation.series.filter((point) => point.seriesKey !== "T10Y2Y")
    : [];

  return <section className="panel mvp-factual-context" aria-labelledby="mvp-factual-title">
    <div className="panel-label"><span>KONTEKS FAKTUAL MVP</span><span>CUTOFF {dateTime(data.asOf)}</span></div>
    <h2 id="mvp-factual-title">Apa yang berubah pada Macro, Bitcoin, dan Gold?</h2>
    <p className="lead-copy">Macro adalah lingkungan penjelas. Angka di bawah menunjukkan perubahan faktual pada horizon yang jelas, tanpa menyimpulkan sebab, arah pasar, atau keputusan trading.</p>

    <section className="factual-group" aria-labelledby="factual-macro-title">
      <div className="factual-group-head"><div><span>MACRO</span><h3 id="factual-macro-title">Suku bunga, inflasi, dolar, dan likuiditas</h3></div><small>Horizon data lambat: 1 minggu dan 4 minggu</small></div>
      {data.macro.ratesInflation.status === "UNAVAILABLE" && <p className="muted">{data.macro.ratesInflation.reason}</p>}
      <div className="factual-card-grid macro">
        {rates.map((point) => <RateCard key={point.seriesKey} point={point} />)}
        <MarketCard label="DXY" series={data.macro.dxy} valueKind="INDEX" />
        <NetLiquidityCard data={data.macro.netLiquidity} />
      </div>
    </section>

    <div className="factual-traded-grid">
      <section className="factual-group" aria-labelledby="factual-crypto-title">
        <div className="factual-group-head"><div><span>CRYPTO</span><h3 id="factual-crypto-title">Bitcoin</h3></div><small>Pasar utama MVP</small></div>
        <MarketCard label="Bitcoin spot" series={data.crypto.bitcoin} valueKind="MONEY" />
      </section>
      <section className="factual-group" aria-labelledby="factual-gold-title">
        <div className="factual-group-head"><div><span>GOLD</span><h3 id="factual-gold-title">Gold Futures</h3></div><small>Pasar utama MVP</small></div>
        <MarketCard label="Gold futures" series={data.gold} valueKind="MONEY" />
      </section>
    </div>
  </section>;
}

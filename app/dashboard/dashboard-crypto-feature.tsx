"use client";

import type { DashboardData } from "@/lib/data/dashboard-data";
import type { DataQuality, Observation, ProviderHealth } from "@/lib/domain/types";
import { relativeTimeID } from "@/lib/data/format";
import { StatusBadge, EmptyPanelNote, observationStatus, numberValue, formatMoney, formatPercent, formatSignedMoney, formatSignedPercentValue, recencyLabel } from "./dashboard-common-ui";

type CryptoMetric = {
  id: string;
  label: string;
  value: number;
  unit: "USD" | "PERCENT";
  observedAt: string;
  quality: DataQuality;
};


function StablecoinLiquidityPanel({ data }: { data: DashboardData["stablecoinLiquidity"] }) {
  const latest = data.latest;
  return <section className="panel decision-panel" aria-labelledby="stablecoin-liquidity-title">
    <div className="panel-label"><span>LIKUIDITAS CRYPTO</span><span>{latest ? recencyLabel(latest.recency) : "BELUM ADA DATA"}</span></div>
    <h2 id="stablecoin-liquidity-title">Supply stablecoin USD</h2>
    <p className="lead-copy">Mengukur total nilai stablecoin berpatokan USD yang beredar. Ini bukan arus ETF dan bukan sinyal arah harga.</p>
    {latest ? <>
      <strong className="decision-value">{formatMoney(latest.value)}</strong>
      <p className="decision-meta">Tanggal data {latest.observedAt.slice(0, 10)} · sumber DefiLlama</p>
      <div className="simple-change-grid">
        <div><span>1 hari</span><strong>{data.change1d ? formatSignedPercentValue(data.change1d.percentChange) : "—"}</strong></div>
        <div><span>1 minggu</span><strong>{data.change1w ? formatSignedPercentValue(data.change1w.percentChange) : "—"}</strong></div>
        <div><span>4 minggu</span><strong>{data.change4w ? formatSignedPercentValue(data.change4w.percentChange) : "—"}</strong></div>
      </div>
      <details className="data-detail">
        <summary>Lihat perubahan nominal</summary>
        <div className="monitor-list">
          <div><strong>1 hari</strong><span>{data.change1d ? formatSignedMoney(data.change1d.absoluteChange) : "Belum tersedia"}</span></div>
          <div><strong>1 minggu</strong><span>{data.change1w ? formatSignedMoney(data.change1w.absoluteChange) : "Belum tersedia"}</span></div>
          <div><strong>4 minggu</strong><span>{data.change4w ? formatSignedMoney(data.change4w.absoluteChange) : "Belum tersedia"}</span></div>
        </div>
      </details>
    </> : <EmptyPanelNote label="likuiditas stablecoin" />}
  </section>;
}

function BtcEtfFlowPanel({ data }: { data: DashboardData["btcEtfFlow"] }) {
  return <section className="panel decision-panel" aria-labelledby="btc-etf-flow-title">
    <div className="panel-label"><span>ARUS MODAL BITCOIN</span><span>{data.latest ? "DATA TERKONFIRMASI" : "BELUM ADA DATA"}</span></div>
    <h2 id="btc-etf-flow-title">ETF Bitcoin spot AS</h2>
    <p className="lead-copy">Menunjukkan uang bersih yang masuk atau keluar dari ETF Bitcoin spot AS. Positif = net inflow, negatif = net outflow.</p>
    {data.latest ? <>
      <strong className="decision-value">{formatSignedMoney(data.latest.value)}</strong>
      <p className="decision-meta">Trading date {data.latest.providerTradingDate} · sumber SoSoValue</p>
      <details className="data-detail">
        <summary>Lihat 5 sesi terakhir</summary>
        <div className="monitor-list">
          {data.recent.map((point) => <div key={point.observationId}><strong>{point.providerTradingDate}</strong><span>{formatSignedMoney(point.value)}</span></div>)}
        </div>
      </details>
    </> : <EmptyPanelNote label="arus ETF Bitcoin" />}
  </section>;
}


function buildCryptoMetrics(observations: Observation[]): CryptoMetric[] {
  const definitions: Array<{ id: string; label: string; unit: "USD" | "PERCENT" }> = [
    { id: "btc.spot.usd", label: "BTC PRICE", unit: "USD" },
    { id: "eth.spot.usd", label: "ETH PRICE", unit: "USD" },
    { id: "btc.market_cap.usd", label: "BTC MARKET CAP", unit: "USD" },
    { id: "eth.market_cap.usd", label: "ETH MARKET CAP", unit: "USD" },
    { id: "crypto.total_market_cap.usd", label: "TOTAL CRYPTO MARKET CAP", unit: "USD" },
    { id: "crypto.total_volume_24h.usd", label: "24H VOLUME", unit: "USD" },
    { id: "crypto.btc_dominance.pct", label: "BTC DOMINANCE", unit: "PERCENT" },
    { id: "crypto.eth_dominance.pct", label: "ETH DOMINANCE", unit: "PERCENT" },
  ];

  return definitions.flatMap((definition) => {
    const item = observations.find((observation) => observation.subject === definition.id);
    if (!item) return [];
    const value = numberValue(item.value);
    if (value === null) return [];
    return [{ id: definition.id, label: definition.label, value, unit: definition.unit, observedAt: item.observedAt, quality: item.quality }];
  });
}


function CryptoMetricCard({ metric }: { metric: CryptoMetric }) {
  return <article className="compact-metric-card"><div className="compact-metric-head"><span>{metric.label}</span><small>{metric.quality}</small></div><strong>{metric.unit === "USD" ? formatMoney(metric.value) : formatPercent(metric.value)}</strong><p>CoinGecko · {relativeTimeID(metric.observedAt)}</p></article>;
}

function CryptoMarketPanel({ observations, providerHealth }: { observations: Observation[]; providerHealth: ProviderHealth[] }) {
  const metrics = buildCryptoMetrics(observations);
  const primaryIds = new Set(["btc.spot.usd", "crypto.total_market_cap.usd", "crypto.btc_dominance.pct"]);
  const primary = metrics.filter((metric) => primaryIds.has(metric.id));
  const secondary = metrics.filter((metric) => !primaryIds.has(metric.id));
  const coinGeckoHealth = providerHealth.find((item) => item.sourceId === "coingecko-market");
  const quality = observationStatus(primary.map((metric) => metric.quality));

  return <section className="panel decision-panel" aria-labelledby="crypto-foundation-title">
    <div className="panel-label"><span>CRYPTO MARKET</span><StatusBadge value={quality} /></div>
    <h2 id="crypto-foundation-title">Harga dan ukuran pasar</h2>
    <p className="lead-copy">Tiga metrik utama untuk orientasi cepat. Data market lain tetap tersedia di bagian detail.</p>
    {primary.length ? <div className="position-grid crypto-primary-grid">{primary.map((metric) => <div key={metric.id}><span>{metric.label.replaceAll("CRYPTO ", "").replaceAll("BTC ", "BTC ")}</span><strong>{metric.unit === "USD" ? formatMoney(metric.value) : formatPercent(metric.value)}</strong><small>{relativeTimeID(metric.observedAt)}</small></div>)}</div> : <EmptyPanelNote label="pasar crypto" />}
    {secondary.length > 0 && <details className="data-detail">
      <summary>Lihat metrik market lainnya</summary>
      <div className="secondary-metric-grid">{secondary.map((metric) => <CryptoMetricCard key={metric.id} metric={metric} />)}</div>
    </details>}
    <p className="decision-meta">CoinGecko · status provider {coinGeckoHealth?.status ?? "UNKNOWN"}</p>
  </section>;
}

export function CryptoSection({ data }: { data: DashboardData }) {
  const { observations, providerHealth } = data;
  return <>
        <div className="page-intro"><span>CRYPTO</span><h1>Harga, likuiditas, dan arus modal</h1><p>Urutannya sederhana: lihat harga pasar, lalu ukuran likuiditas stablecoin, lalu arus ETF Bitcoin. Berita Crypto tersedia di Konteks.</p></div>
        <CryptoMarketPanel observations={observations} providerHealth={providerHealth} />
        <div className="decision-grid">
          <StablecoinLiquidityPanel data={data.stablecoinLiquidity} />
          <BtcEtfFlowPanel data={data.btcEtfFlow} />
        </div>
      </>;
}

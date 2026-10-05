"use client";
import { NetLiquidityPanel } from "./net-liquidity-panel";
import { RatesInflationPanel } from "./rates-inflation-panel";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { relativeTimeID } from "@/lib/data/format";
import type { DashboardData } from "@/lib/data/dashboard-data";
import type { CalendarEvent, NewsItem } from "@/lib/data/types";
import type { Context, DataQuality, Evidence, Observation, ProviderHealth } from "@/lib/domain/types";
import { buildBaselinePresentations, type BaselinePresentation } from "@/lib/presentation/baseline";
import { formatMacroDisplayDelta, formatMacroDisplayValue } from "@/lib/presentation/macro-display";
import { logout, refreshDashboardData } from "./actions";
import { EventRiskWindowPanel } from "./event-risk-window-panel";
import { IntradayEventResponsePanel } from "./intraday-event-response-panel";
import { MvpFactualContextPanel } from "./mvp-factual-context-panel";
import { FactualMarketBriefingPanel } from "./factual-market-briefing-panel";
import { CatalystWirePanel } from "./catalyst-wire-panel";
import { MaterialMoveMonitorPanel } from "./material-move-monitor-panel";

type Menu = "overview" | "heatmap" | "macro" | "crypto" | "gold" | "context" | "evidence";
const menuItems: { id: Menu; label: string }[] = [
  { id: "overview", label: "Ringkasan" },
  { id: "heatmap", label: "Pasar" },
  { id: "macro", label: "Makro" },
  { id: "crypto", label: "Crypto" },
  { id: "gold", label: "Gold" },
  { id: "context", label: "Konteks" },
  { id: "evidence", label: "Sumber Data" },
];

const MACRO_CONTEXT_LABELS: Record<string, string> = {
  MACRO_MONETARY_POLICY: "Monetary Policy",
  MACRO_LIQUIDITY: "Liquidity",
  MACRO_INFLATION: "Inflation",
  MACRO_LABOR: "Labor",
  MACRO_RATES: "Rates",
  MACRO_USD: "USD",
  MACRO_GROWTH: "Growth",
};

const MACRO_HEADLINE_SERIES: Record<string, string> = {
  MACRO_MONETARY_POLICY: "EFFR",
  MACRO_LIQUIDITY: "RRPONTSYD",
  MACRO_INFLATION: "CPIAUCSL",
  MACRO_LABOR: "ICSA",
  MACRO_RATES: "DGS10",
  MACRO_USD: "DTWEXBGS",
  MACRO_GROWTH: "GDPC1",
};

const MACRO_SERIES_LABELS: Record<string, string> = {
  FEDFUNDS: "Federal Funds Rate", EFFR: "Effective Fed Funds Rate", WALCL: "Fed Balance Sheet", WRESBAL: "Reserve Balances",
  M2SL: "M2 Money Stock", WTREGEN: "Treasury General Account", RRPONTSYD: "Overnight Reverse Repo",
  CPIAUCSL: "Headline CPI", CPILFESL: "Core CPI", PCEPI: "PCE Price Index", PCEPILFE: "Core PCE",
  UNRATE: "Unemployment Rate", PAYEMS: "Nonfarm Payrolls", ICSA: "Initial Claims", CCSA: "Continued Claims", JTSJOL: "Job Openings", JTSQUR: "Quits Rate", SAHMREALTIME: "Sahm Rule",
  DGS2: "US Treasury 2Y", DGS10: "US Treasury 10Y", DFII10: "US 10Y Real Yield", T10YIE: "10Y Breakeven Inflation", T10Y2Y: "10Y–2Y Spread", BAMLC0A0CM: "US Corporate Credit Spread", BAMLH0A0HYM2: "US High Yield Spread",
  DTWEXBGS: "Fed Broad USD Index", GDPC1: "Real GDP",
};

type ContextGroup = { id: string; label: string; contexts: Context[] };

type CryptoMetric = {
  id: string;
  label: string;
  value: number;
  unit: "USD" | "PERCENT";
  observedAt: string;
  quality: DataQuality;
};

const STATUS_LABEL_ID: Record<"PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE", string> = {
  PENDING: "BELUM ADA",
  FRESH: "TERBARU",
  PARTIAL: "SEBAGIAN",
  UNAVAILABLE: "TIDAK TERSEDIA",
};
function StatusBadge({ value }: { value: "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" }) {
  return <span className={`status-badge ${value.toLowerCase()}`}>{STATUS_LABEL_ID[value]}</span>;
}

function EmptyPanelNote({ label }: { label: string }) {
  return <p className="muted">Data {label} belum tersedia saat ini. Coba muat ulang beberapa saat lagi.</p>;
}

function NewsCard({ item }: { item: NewsItem }) {
  return <article className="evidence-item"><div className="card-meta"><span>{item.category}</span><span>{item.source} · {relativeTimeID(item.publishedAt)}</span></div><h3>{item.title}</h3><p>{item.summary}</p><a className="text-link" href={item.url} target="_blank" rel="noreferrer">Baca sumber ↗</a></article>;
}

function CalendarRow({ item }: { item: CalendarEvent }) {
  return <article className="calendar-row"><time dateTime={item.dateISO} aria-label={`${item.event}, ${item.status}, ${item.time} WIB`}>{item.time}<small>WIB</small></time><div><h3>{item.event}</h3><p>{item.country} · {item.status}</p></div><span className={`impact ${item.impact.toLowerCase()}`}>{item.impact}</span></article>;
}

function macroThemeItems(context: Context, observations: Observation[]): Observation[] {
  return context.observationIds.map((id) => observations.find((item) => item.id === id)).filter((item): item is Observation => Boolean(item));
}

function macroHeadline(context: Context, items: Observation[]): Observation | undefined {
  const preferred = MACRO_HEADLINE_SERIES[context.scope];
  return items.find((item) => String(item.metadata?.seriesId ?? "") === preferred)
    ?? [...items].sort((a, b) => ({ DAILY: 0, WEEKLY: 1, MONTHLY: 2, QUARTERLY: 3 }[String(a.metadata?.frequency)] ?? 9) - ({ DAILY: 0, WEEKLY: 1, MONTHLY: 2, QUARTERLY: 3 }[String(b.metadata?.frequency)] ?? 9))[0];
}

function MacroThemeCard({ context, observations, baselines, expanded, onToggle }: { context: Context; observations: Observation[]; baselines: Map<string, BaselinePresentation>; expanded: boolean; onToggle: () => void }) {
  const items = macroThemeItems(context, observations);
  const headline = macroHeadline(context, items);
  if (!headline) return null;
  const headlineUnit = String(headline.metadata?.unit ?? "");
  const label = MACRO_CONTEXT_LABELS[context.scope] ?? context.scope;
  const headlineSeries = String(headline.metadata?.seriesId ?? "");

  return <article className={`macro-theme-card${expanded ? " expanded" : ""}`}>
    <button type="button" className="macro-theme-summary" aria-expanded={expanded} onClick={onToggle}>
      <div className="macro-tile-header"><span className="macro-frequency">{label.toUpperCase()}</span><span className="macro-quality">{headline.quality}</span></div>
      <div className="macro-tile-main"><div><h3>{MACRO_SERIES_LABELS[headlineSeries] ?? headline.subject}</h3><small>{headlineSeries} · {String(headline.metadata?.frequency ?? "")}</small></div><strong className="macro-value">{formatMacroDisplayValue(headline.value, headlineUnit)}</strong></div>
      <div className="macro-tile-footer"><span>{items.length} INDIKATOR</span><span>{expanded ? "TUTUP ↑" : "LIHAT DETAIL ↓"}</span></div>
    </button>
    {expanded && <div className="macro-theme-detail">{items.map((item) => {
      const metadata = item.metadata ?? {};
      const unit = String(metadata.unit ?? "");
      const seriesId = String(metadata.seriesId ?? "");
      const baseline = baselines.get(seriesId) ?? null;
      return <div className="macro-detail-row" key={item.id}><div><strong>{MACRO_SERIES_LABELS[seriesId] ?? item.subject}</strong><small>{seriesId} · {String(metadata.frequency ?? "UNKNOWN")} · {item.quality}</small></div><div className="macro-detail-values"><strong>{formatMacroDisplayValue(item.value, unit)}</strong><small>{baseline?.baselineValue !== null && baseline?.baselineValue !== undefined ? `Ref ${formatMacroDisplayValue(baseline.baselineValue, unit)} · ${formatMacroDisplayDelta(baseline.changeValue, unit)}` : `Pembanding ${baseline?.status ?? "MISSING"}`}</small></div></div>;
    })}<div className="macro-theme-metadata"><span>Setiap indikator tetap dihitung terpisah; kartu ini hanya mengelompokkan tampilan.</span><span>Sumber · FRED</span></div></div>}
  </article>;
}

function ContextCard({ context, label, selected, onClick }: { context: Context; label: string; selected: boolean; onClick: () => void }) {
  return <button type="button" className={`context-card context-card-button${selected ? " selected" : ""}`} aria-pressed={selected} onClick={onClick}><div className="context-card-head"><span className="context-scope">{label}</span><span className="context-count">{context.observationIds.length} OBS · {context.eventIds.length} EVENT</span></div><h3>{context.statement}</h3><p>Terkait langsung ke data dan event yang membentuk konteks ini. Klik untuk melihat rinciannya.</p></button>;
}

function ContextDetail({ context, label }: { context: Context; label: string }) {
  return <section className="panel context-detail"><div className="panel-label"><span>RINCIAN KONTEKS</span><span>{label}</span></div><h2>{context.statement}</h2><p className="lead-copy">Konteks hanya mengelompokkan data yang sudah tersedia. Bagian ini tidak memberi sinyal arah pasar.</p><div className="monitor-list"><div><strong>SCOPE</strong><span>{context.scope}</span></div><div><strong>OBSERVATIONS</strong><span>{context.observationIds.length ? context.observationIds.join(" · ") : "Tidak ada"}</span></div><div><strong>EVENTS</strong><span>{context.eventIds.length ? context.eventIds.join(" · ") : "Tidak ada"}</span></div><div><strong>CREATED</strong><span>{relativeTimeID(context.createdAt)}</span></div></div></section>;
}

function observationStatus(qualities: DataQuality[]): "PENDING" | "FRESH" | "PARTIAL" {
  return qualities.length === 0 ? "PENDING" : qualities.every((item) => item === "FRESH") ? "FRESH" : "PARTIAL";
}


function numberValue(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatSignedMoney(value: number): string {
  return `${value > 0 ? "+" : ""}${formatMoney(value)}`;
}

function formatSignedPercentValue(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatContracts(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function recencyLabel(value: "CURRENT" | "STALE" | "UNKNOWN"): string {
  if (value === "CURRENT") return "TERBARU";
  if (value === "STALE") return "PERLU DIPERBARUI";
  return "STATUS WAKTU BELUM PASTI";
}

function qualityLabel(value: DataQuality): string {
  if (value === "FRESH") return "TERBARU";
  if (value === "STALE") return "PERLU DIPERBARUI";
  return "TERSEDIA";
}

function observationChangePercent(observation: Observation | undefined): number | null {
  const raw = observation?.metadata?.changePct;
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function TerminalChange({ value, label = "PERUBAHAN" }: { value: number | null; label?: string }) {
  const direction = value === null || value === 0 ? "neutral" : value > 0 ? "up" : "down";
  return <span className={`terminal-change ${direction}`}>{label} {value === null ? "—" : formatSignedPercentValue(value)}</span>;
}

function marketTapeQualityTone(value: DataQuality | undefined): "current" | "stale" | "neutral" {
  if (value === "FRESH") return "current";
  if (value === "STALE") return "stale";
  return "neutral";
}

function marketTapeRecencyTone(value: "CURRENT" | "STALE" | "UNKNOWN" | undefined): "current" | "stale" | "neutral" {
  if (value === "CURRENT") return "current";
  if (value === "STALE") return "stale";
  return "neutral";
}

function OverviewMarketTape({ data, observations }: { data: DashboardData; observations: Observation[] }) {
  const bitcoin = observations.find((item) => item.subject === "btc.spot.usd");
  const gold = observations.find((item) => item.subject === "gold.futures.usd");
  const dxy = observations.find((item) => item.subject === "dxy.index.usd");
  const us10y = observations.find((item) => String(item.metadata?.seriesId ?? "") === "DGS10");
  const bitcoinValue = bitcoin ? numberValue(bitcoin.value) : null;
  const goldValue = gold ? numberValue(gold.value) : null;
  const dxyValue = dxy ? numberValue(dxy.value) : null;
  const stablecoin = data.stablecoinLiquidity.latest;
  const stablecoinChange = data.stablecoinLiquidity.change1d?.percentChange ?? null;
  const etfFlow = data.btcEtfFlow.latest;

  return <section className="market-terminal-strip" aria-labelledby="market-tape-title">
    <div className="market-terminal-ambient" aria-hidden="true" />
    <div className="market-terminal-head">
      <div>
        <span className="market-terminal-kicker">MARKET TAPE · FAKTUAL</span>
        <h2 id="market-tape-title">Snapshot lintas pasar</h2>
        <p className="market-terminal-subtitle">Harga, yield, flow, dan likuiditas utama dalam satu pandangan. Tidak ada sinyal arah yang ditambahkan.</p>
      </div>
      <div className="market-terminal-cutoff">
        <span>CUTOFF</span>
        <strong>{relativeTimeID(data.mvpFactualContext.asOf)}</strong>
      </div>
    </div>

    <div className="market-terminal-grid">
      <article className="market-terminal-card primary">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">BTC</span><small>SPOT</small></div>
          <span className={`market-terminal-status ${marketTapeQualityTone(bitcoin?.quality)}`}>{bitcoin ? qualityLabel(bitcoin.quality) : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{bitcoinValue !== null ? formatMoney(bitcoinValue) : "—"}</strong>
        <TerminalChange value={observationChangePercent(bitcoin)} />
        <small className="market-terminal-source">{bitcoin ? `CoinGecko · ${relativeTimeID(bitcoin.observedAt)}` : "Harga spot belum tersedia"}</small>
      </article>

      <article className="market-terminal-card">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">GOLD</span><small>FUTURES</small></div>
          <span className={`market-terminal-status ${marketTapeQualityTone(gold?.quality)}`}>{gold ? qualityLabel(gold.quality) : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{goldValue !== null ? formatMoney(goldValue) : "—"}</strong>
        <TerminalChange value={observationChangePercent(gold)} />
        <small className="market-terminal-source">{gold ? `Yahoo · GC=F · ${relativeTimeID(gold.observedAt)}` : "Gold futures belum tersedia"}</small>
      </article>

      <article className="market-terminal-card">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">DXY</span><small>USD INDEX</small></div>
          <span className={`market-terminal-status ${marketTapeQualityTone(dxy?.quality)}`}>{dxy ? qualityLabel(dxy.quality) : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{dxyValue !== null ? dxyValue.toFixed(2) : "—"}</strong>
        <TerminalChange value={observationChangePercent(dxy)} />
        <small className="market-terminal-source">{dxy ? `Yahoo · DX-Y.NYB · ${relativeTimeID(dxy.observedAt)}` : "Dollar Index belum tersedia"}</small>
      </article>

      <article className="market-terminal-card">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">US 10Y</span><small>YIELD</small></div>
          <span className={`market-terminal-status ${marketTapeQualityTone(us10y?.quality)}`}>{us10y ? qualityLabel(us10y.quality) : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{us10y ? formatMacroDisplayValue(us10y.value, String(us10y.metadata?.unit ?? "")) : "—"}</strong>
        <span className="terminal-change neutral">TREASURY YIELD</span>
        <small className="market-terminal-source">{us10y ? `FRED · DGS10 · ${relativeTimeID(us10y.observedAt)}` : "Yield 10Y belum tersedia"}</small>
      </article>

      <article className="market-terminal-card">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">BTC ETF</span><small>NET FLOW</small></div>
          <span className={`market-terminal-status ${etfFlow ? "mature" : "neutral"}`}>{etfFlow ? "MATANG" : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{etfFlow ? formatSignedMoney(etfFlow.value) : "—"}</strong>
        <span className={`terminal-change ${etfFlow ? (etfFlow.value > 0 ? "up" : etfFlow.value < 0 ? "down" : "neutral") : "neutral"}`}>NET FLOW</span>
        <small className="market-terminal-source">{etfFlow ? `SoSoValue · sesi ${etfFlow.providerTradingDate}` : "Flow matang belum tersedia"}</small>
      </article>

      <article className="market-terminal-card">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">STABLECOIN</span><small>USD SUPPLY</small></div>
          <span className={`market-terminal-status ${marketTapeRecencyTone(stablecoin?.recency)}`}>{stablecoin ? recencyLabel(stablecoin.recency) : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{stablecoin ? formatMoney(stablecoin.value) : "—"}</strong>
        <TerminalChange value={stablecoinChange} label="1 HARI" />
        <small className="market-terminal-source">{stablecoin ? `DefiLlama · ${stablecoin.observedAt.slice(0, 10)}` : "Supply USD stablecoin belum tersedia"}</small>
      </article>
    </div>

    <div className="market-terminal-foot">
      <span>FAKTUAL · NON-PRESKRIPTIF</span>
      <span>ETF: MATANG = lolos kebijakan finalitas P365, bukan status freshness.</span>
    </div>
  </section>;
}
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

function GoldPricePanel({ observations }: { observations: Observation[] }) {
  const observation = observations.find((item) => item.subject === "gold.futures.usd");
  const value = observation ? numberValue(observation.value) : null;
  return <section className="panel decision-panel" aria-labelledby="gold-market-title">
    <div className="panel-label"><span>HARGA GOLD</span><span>{observation ? qualityLabel(observation.quality) : "BELUM ADA DATA"}</span></div>
    <h2 id="gold-market-title">Gold futures</h2>
    <p className="lead-copy">Harga Gold dan posisi trader ditampilkan terpisah. P365 belum menyimpulkan bahwa satu posisi tertentu harus membuat harga naik atau turun.</p>
    {observation && value !== null ? <>
      <strong className="decision-value">{formatMoney(value)}</strong>
      <p className="decision-meta">COMEX GC=F · {relativeTimeID(observation.observedAt)}</p>
    </> : <EmptyPanelNote label="harga Gold" />}
    <div className="plain-notice"><strong>ETF Gold global</strong><span>Belum tersedia karena sumber runtime global yang memenuhi kontrak belum lolos kualifikasi.</span></div>
  </section>;
}

function GoldPositioningPanel({ data }: { data: DashboardData["goldPositioning"] }) {
  return <section className="panel decision-panel" aria-labelledby="gold-positioning-title">
    <div className="panel-label"><span>POSISI TRADER GOLD</span><span>{data.status === "AVAILABLE" ? "TERSEDIA" : "BELUM ADA DATA"}</span></div>
    <h2 id="gold-positioning-title">Managed Money di COMEX Gold</h2>
    <p className="lead-copy">Laporan mingguan CFTC. Angka di bawah adalah jumlah kontrak mentah; belum diubah menjadi net position, percentile, crowding, atau sinyal arah.</p>
    {data.status === "AVAILABLE" ? <>
      <p className="decision-meta">Laporan {data.reportDate} · CFTC Disaggregated Futures Only</p>
      <div className="position-grid">
        <div><span>Long</span><strong>{formatContracts(data.managedMoney.long.value)}</strong><small>kontrak sisi long</small></div>
        <div><span>Short</span><strong>{formatContracts(data.managedMoney.short.value)}</strong><small>kontrak sisi short</small></div>
        <div><span>Spreading</span><strong>{formatContracts(data.managedMoney.spreading.value)}</strong><small>posisi offset / spread</small></div>
      </div>
      <div className="plain-notice"><strong>Total open interest</strong><span>{formatContracts(data.openInterest.value)} kontrak terbuka</span></div>
    </> : <p className="muted">{data.reason}</p>}
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

type CrossAssetMetric = {
  id: string;
  label: string;
  providerLabel: string;
  value: number;
  unit: "USD" | "INDEX";
  observedAt: string;
  quality: DataQuality;
};

function buildCrossAssetMetrics(observations: Observation[]): CrossAssetMetric[] {
  const definitions: Array<Omit<CrossAssetMetric, "value" | "observedAt" | "quality">> = [
    { id: "gold.futures.usd", label: "GOLD · COMEX FRONT-MONTH", providerLabel: "Yahoo Finance · GC=F", unit: "USD" },
    { id: "russell2000.index.usd", label: "RUSSELL 2000 INDEX", providerLabel: "Yahoo Finance · ^RUT", unit: "INDEX" },
    { id: "dxy.index.usd", label: "DXY · ICE U.S. DOLLAR INDEX", providerLabel: "Yahoo Finance · DX-Y.NYB", unit: "INDEX" },
  ];

  return definitions.flatMap((definition) => {
    const item = observations.find((observation) => observation.subject === definition.id);
    if (!item) return [];
    const value = numberValue(item.value);
    if (value === null) return [];
    return [{ ...definition, value, observedAt: item.observedAt, quality: item.quality }];
  });
}

function CrossAssetMarketPanel({ observations }: { observations: Observation[] }) {
  const metrics = buildCrossAssetMetrics(observations);
  const broadUsd = observations.find((item) => String(item.metadata?.seriesId ?? "") === "DTWEXBGS");

  return <section className="panel" aria-labelledby="cross-asset-title">
    <div className="panel-label"><span>CROSS-ASSET MARKET</span><StatusBadge value={observationStatus(metrics.map((metric) => metric.quality))} /></div>
    <h2 id="cross-asset-title">Gold, Russell 2000 & Dollar Index</h2>
    <p className="lead-copy">Market observations are shown as distinct instruments. DXY is the ICE U.S. Dollar Index and is not the Federal Reserve broad trade-weighted dollar index.</p>
    {metrics.length ? <div className="metric-card-grid">{metrics.map((metric) => <article className="compact-metric-card" key={metric.id}><div className="compact-metric-head"><span>{metric.label}</span><small>{metric.quality}</small></div><strong>{metric.unit === "USD" ? formatMoney(metric.value) : metric.value.toFixed(2)}</strong><p>{metric.providerLabel} · {relativeTimeID(metric.observedAt)}</p></article>)}</div> : <EmptyPanelNote label="Gold, Russell 2000, dan DXY" />}
    <div className="monitor-list" style={{ marginTop: "1rem" }}><div><strong>USD INDEX SEMANTICS</strong><span>DXY / ICE U.S. Dollar Index = DX-Y.NYB · Fed Broad Trade-Weighted USD = DTWEXBGS{broadUsd ? " · keduanya tersedia sebagai metric berbeda" : ""}.</span></div></div>
  </section>;
}

type HeatmapTile = {
  id: string;
  label: string;
  group: "CROSS-ASSET" | "MACRO" | "CRYPTO";
  value: string;
  delta: number | null;
  deltaUnit: "ABSOLUTE" | "PERCENT";
  changeBasis?: string;
  source: string;
};

function MarketHeatmap({ observations, baselines }: { observations: Observation[]; baselines: BaselinePresentation[] }) {
  const baselineBySeries = new Map(baselines.map((item) => [item.seriesId, item]));
  const definitions = [
    { id: "gold.futures.usd", label: "GOLD", group: "CROSS-ASSET" as const, source: "Yahoo · GC=F" },
    { id: "russell2000.index.usd", label: "RUSSELL 2000", group: "CROSS-ASSET" as const, source: "Yahoo · ^RUT" },
    { id: "dxy.index.usd", label: "DXY · ICE", group: "CROSS-ASSET" as const, source: "Yahoo · DX-Y.NYB" },
    { id: "btc.spot.usd", label: "BITCOIN", group: "CRYPTO" as const, source: "CoinGecko" },
    { id: "eth.spot.usd", label: "ETHEREUM", group: "CRYPTO" as const, source: "CoinGecko" },
    { id: "crypto.btc_dominance.pct", label: "BTC DOMINANCE", group: "CRYPTO" as const, source: "CoinGecko" },
  ];
  const marketTiles: HeatmapTile[] = definitions.flatMap((definition) => {
    const observation = observations.find((item) => item.subject === definition.id);
    if (!observation) return [];
    const rawChangePct = observation.metadata?.changePct;
    const hasProviderChange = rawChangePct !== null && rawChangePct !== undefined && Number.isFinite(Number(rawChangePct));
    const providerChangePct = hasProviderChange ? Number(rawChangePct) : null;
    return [{ ...definition, value: observation.value, delta: providerChangePct, deltaUnit: "PERCENT" as const, changeBasis: hasProviderChange ? String(observation.metadata?.changeBasis ?? "provider_reference") : undefined }];
  });
  const macroScopes = ["MACRO_MONETARY_POLICY", "MACRO_LIQUIDITY", "MACRO_INFLATION", "MACRO_LABOR", "MACRO_RATES", "MACRO_USD", "MACRO_GROWTH"];
  const macroTiles: HeatmapTile[] = macroScopes.flatMap((scope) => {
    const preferredSeries = MACRO_HEADLINE_SERIES[scope];
    const observation = observations.find((item) => item.domain === "MACRO" && String(item.metadata?.seriesId ?? "") === preferredSeries);
    if (!observation) return [];
    const seriesId = String(observation.metadata?.seriesId ?? "");
    const baseline = baselineBySeries.get(seriesId);
    return [{ id: scope, label: MACRO_CONTEXT_LABELS[scope] ?? scope, group: "MACRO" as const, value: formatMacroDisplayValue(observation.value, String(observation.metadata?.unit ?? "")), delta: baseline?.status === "VALID" ? baseline.changeValue : null, deltaUnit: "ABSOLUTE" as const, source: `${MACRO_SERIES_LABELS[seriesId] ?? seriesId} · ${seriesId}` }];
  });
  const tiles = [...marketTiles, ...macroTiles];
  const groups: Array<HeatmapTile["group"]> = ["CROSS-ASSET", "MACRO", "CRYPTO"];

  return <section className="heatmap-view" aria-labelledby="heatmap-title">
    <div className="heatmap-heading"><div><div className="panel-label"><span>PETA PASAR</span><span>FAKTUAL · NON-PRESKRIPTIF</span></div><h2 id="heatmap-title">Heatmap Pasar</h2><p className="lead-copy">Warna hanya menunjukkan perubahan faktual terhadap baseline valid. Tanpa baseline yang valid, tile tetap netral.</p></div><div className="heatmap-legend"><span><i className="heatmap-dot up" /> Naik</span><span><i className="heatmap-dot down" /> Turun</span><span><i className="heatmap-dot neutral" /> Netral / belum ada baseline</span></div></div>
    <div className="heatmap-groups">{groups.map((group) => {
      const items = tiles.filter((tile) => tile.group === group);
      if (!items.length) return null;
      return <section className="heatmap-group" key={group}><div className="heatmap-group-head"><strong>{group}</strong><span>{items.length} METRIC</span></div><div className="heatmap-grid">{items.map((tile) => {
        const direction = tile.delta === null || tile.delta === 0 ? "neutral" : tile.delta > 0 ? "up" : "down";
        return <article className={`heatmap-tile ${direction}`} key={tile.id}><span className="heatmap-name">{tile.label}</span><strong>{tile.delta === null ? "—" : `${tile.delta > 0 ? "+" : ""}${tile.delta.toFixed(2)}${tile.deltaUnit === "PERCENT" ? "%" : ""}`}</strong><span className="heatmap-value">{tile.value}</span><small>{tile.source}{tile.changeBasis ? ` · ${tile.changeBasis.replace("_", " ")}` : ""}</small></article>;
      })}</div></section>;
    })}</div>
    <div className="heatmap-semantic-note"><strong>USD INDEX SEMANTICS</strong><span>DXY · ICE = DX-Y.NYB. FED BROAD USD = DTWEXBGS. Keduanya merupakan metric berbeda dan tidak diperlakukan sebagai substitusi.</span></div>
  </section>;
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

function OverviewContext({ contextGroups, selectedContextId, selectedContext, onSelect }: { contextGroups: ContextGroup[]; selectedContextId: string | null; selectedContext: Context | null; onSelect: (id: string) => void }) {
  return <section className="panel intelligence-panel" aria-labelledby="overview-context-title" style={{ marginTop: "20px" }}>
    <div className="panel-label"><span>03 / CONTEXT</span><span>{contextGroups.reduce((total, group) => total + group.contexts.length, 0)} CONTEXT</span></div>
    <h2 id="overview-context-title">Why this context matters</h2>
    <p className="lead-copy">Context menghubungkan observasi dan event yang sudah tersedia tanpa membuat kesimpulan pasar. Gunakan layer ini untuk memahami relevansi sebelum membuka evidence atau detail.</p>
    <div className="context-groups">
      {contextGroups.length ? contextGroups.map((group) => <section className="context-group expanded" key={group.id}>
        <div className="context-group-button" aria-label={`${group.label} context group`}><span><small>CONTEXT GROUP</small><strong>{group.label}</strong></span><span>{group.contexts.length} CONTEXT</span></div>
        <div className="context-list">
          {group.contexts.map((context) => {
            const label = context.scope === "CRYPTO_MARKET" ? context.id.replace("context-crypto-", "").toUpperCase() : context.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[context.scope] ?? context.scope.replaceAll("MACRO_", "").replaceAll("_", " ");
            return <ContextCard context={context} label={label} selected={selectedContextId === context.id} onClick={() => onSelect(context.id)} key={context.id} />;
          })}
        </div>
      </section>) : <EmptyPanelNote label="context" />}
    </div>
    {selectedContext ? <ContextDetail context={selectedContext} label={selectedContext.scope === "CRYPTO_MARKET" ? selectedContext.id.replace("context-crypto-", "").toUpperCase() : selectedContext.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[selectedContext.scope] ?? selectedContext.scope.replaceAll("MACRO_", "").replaceAll("_", " ")} /> : <div className="context-detail-empty"><div className="panel-label"><span>RINCIAN KONTEKS</span><span>PILIH KONTEKS</span></div><h3>Pilih konteks</h3><p className="lead-copy">Pilih konteks untuk melihat data dan event yang terkait.</p></div>}
  </section>;
}

export function DashboardView({ data, sessionEmail }: { data: DashboardData; sessionEmail: string }) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<Menu>("overview");
  const [isRefreshing, startRefresh] = useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedMacroTheme, setExpandedMacroTheme] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { macroNews, cryptoNews, calendarEvents, events, observations, macroObservations, macroBaselines, contexts, evidence, providerHealth } = data;
  const baselinePresentations = buildBaselinePresentations(macroBaselines);
  const baselinesBySeries = new Map(baselinePresentations.map((item) => [item.seriesId, item]));

  useEffect(() => {
    if (!navOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [navOpen]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [navOpen]);

  function handleManualRefresh() { startRefresh(async () => { const result = await refreshDashboardData(); setLastRefreshedAt(result.refreshedAt); router.refresh(); }); }

  const cryptoContexts = contexts.filter((context) => context.scope === "CRYPTO_MARKET");
  const macroContexts = contexts.filter((context) => context.scope.startsWith("MACRO_"));
  const economicEventContexts = contexts.filter((context) => context.scope === "ECONOMIC_EVENTS");
  const contextGroups: ContextGroup[] = [{ id: "crypto", label: "CRYPTO MARKET", contexts: cryptoContexts }, { id: "macro", label: "MACRO", contexts: macroContexts }, { id: "events", label: "ECONOMIC EVENTS", contexts: economicEventContexts }].filter((group) => group.contexts.length > 0);
  const selectedContext = contexts.find((context) => context.id === selectedContextId) ?? null;
  const selectedLabel = selectedContext ? selectedContext.scope === "CRYPTO_MARKET" ? selectedContext.id.replace("context-crypto-", "").toUpperCase() : selectedContext.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[selectedContext.scope] ?? selectedContext.scope.replaceAll("MACRO_", "").replaceAll("_", " ") : "";
  const showNews = (items: NewsItem[], label: string) => {
    const visible = items.slice(0, 6);
    const overflow = items.slice(6);
    return <section className="panel news-panel">
      <div className="panel-label"><span>{label}</span><span>{items.length} ITEM</span></div>
      <h2>Evidence berita terbaru</h2>
      <div className="news-list">{visible.length ? visible.map((item) => <NewsCard item={item} key={item.id} />) : <EmptyPanelNote label={label.toLowerCase()} />}</div>
      {overflow.length > 0
        ? <details className="news-more">
            <summary><span>{overflow.length} berita lainnya</span><strong>LIHAT SEMUA</strong></summary>
            <div className="news-list">{overflow.map((item) => <NewsCard item={item} key={item.id} />)}</div>
          </details>
        : null}
    </section>;
  };

  return <main className="dashboard-shell">
    <header className="topbar"><div className="topbar-brand-group"><button className="nav-toggle" type="button" aria-label={navOpen ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={navOpen} aria-controls="dashboard-navigation" onClick={() => setNavOpen((open) => !open)}><span /><span /><span /></button><div className="brand-lockup"><img className="brand-logo" src="/project365-logo.svg" alt="PROJECT365" style={{ width: "clamp(1.05rem, 2.2vw, 1.45rem)", height: "clamp(1.05rem, 2.2vw, 1.45rem)", objectFit: "contain", flexShrink: 0 }} /><p className="eyebrow" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", lineHeight: 1, letterSpacing: "-0.02em", margin: 0 }}>PROJECT365</p></div></div><div className="topbar-actions">{lastRefreshedAt && <p className="muted refresh-note">Refresh manual terakhir: {relativeTimeID(lastRefreshedAt)}</p>}<button className="refresh-btn" type="button" onClick={handleManualRefresh} disabled={isRefreshing} aria-busy={isRefreshing}>{isRefreshing ? "Memuat ulang…" : "Muat ulang manual"}</button><div style={{ position: "relative" }}><button type="button" aria-label="Buka menu akun" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)} style={{ width: 36, height: 36, display: "grid", placeItems: "center", padding: 0, border: "1px solid var(--line)", borderRadius: 4, background: accountOpen ? "#151d19" : "transparent", color: accountOpen ? "var(--lime)" : "var(--text)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.7-3.5 3-5.3 6.5-5.3s5.8 1.8 6.5 5.3" /></svg></button>{accountOpen && <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 220, padding: 8, border: "1px solid var(--line)", borderRadius: 5, background: "#101513", boxShadow: "0 12px 30px rgba(0,0,0,.35)", zIndex: 60 }}><div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--line)" }}><span style={{ display: "block", color: "var(--muted)", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: ".08em" }}>AKUN</span><strong style={{ display: "block", marginTop: 5, fontSize: 12, overflowWrap: "anywhere" }}>{sessionEmail}</strong></div><form action={logout}><button type="submit" style={{ width: "100%", marginTop: 8, padding: "9px 10px", textAlign: "left", border: "1px solid var(--line)", borderRadius: 4, background: "transparent", color: "var(--text)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Keluar</button></form></div>}</div></div></header>
    {navOpen && <button className="nav-backdrop" type="button" aria-label="Tutup navigasi" onClick={() => setNavOpen(false)} />}
    <nav id="dashboard-navigation" className={`filters${navOpen ? " open" : ""}`} aria-label="Bagian dashboard" role="tablist">{menuItems.map((item) => <button key={item.id} type="button" role="tab" aria-selected={activeMenu === item.id} className={activeMenu === item.id ? "active" : ""} onClick={() => { setActiveMenu(item.id); setNavOpen(false); }}>{item.label}</button>)}<span>WIB / ASIA-JAKARTA</span></nav>

    <div className="dashboard-content" role="tabpanel">
      {activeMenu === "overview" && <>
        <div className="page-intro"><span>DASHBOARD UTAMA</span><h1>Pasar sekarang</h1><p>Mulai dari ringkasan, lalu lihat perubahan terbaru dan event yang berpotensi menggerakkan pasar. Detail teknis disimpan di bagian lanjutan.</p></div>
        <OverviewMarketTape data={data} observations={observations} />
        <div className="overview-intelligence-grid">
          <MaterialMoveMonitorPanel data={data.materialMoveMonitor} />
          <CatalystWirePanel data={data.catalystWire} />
        </div>
        <div className="overview-briefing">
          <FactualMarketBriefingPanel data={data.factualMarketBriefing} />
        </div>

        <details className="overview-event-details">
          <summary>
            <div>
              <span>EVENT LAYER · SEKUNDER</span>
              <strong>Kalender & respons event intraday</strong>
            </div>
            <span>Buka detail</span>
          </summary>
          <div className="overview-event-details-body">
            <EventRiskWindowPanel events={[...events, ...data.durableHighImpactEvents]} asOf={data.mvpFactualContext.asOf} />
            <IntradayEventResponsePanel result={data.intradayEventMonitor} />
          </div>
        </details>

        <details className="advanced-details">
          <summary>Lihat detail makro & likuiditas</summary>
          <div className="advanced-details-body">
            <MvpFactualContextPanel data={data.mvpFactualContext} />
            <div className="intraday-secondary-grid">
              <NetLiquidityPanel data={data.netLiquidity} />
              <RatesInflationPanel data={data.ratesInflation} />
            </div>
          </div>
        </details>
      </>}
      {activeMenu === "heatmap" && <MarketHeatmap observations={observations} baselines={baselinePresentations} />}
      {activeMenu === "macro" && <><div className="page-intro"><span>MAKRO</span><h1>Faktor makro yang perlu dipantau</h1><p>Mulai dari rates, inflasi, likuiditas, tenaga kerja, USD, dan pertumbuhan. Buka kartu hanya jika ingin detail indikator.</p></div><div className="menu-grid"><CrossAssetMarketPanel observations={observations} />{showNews(macroNews, "BERITA MAKRO")}<section className="panel calendar macro-theme-panel"><div className="panel-label"><span>DATA MAKRO</span><span>{macroContexts.length} TEMA · {macroObservations.length} INDIKATOR</span></div><h2>Indikator utama</h2>{macroObservations.length ? macroContexts.map((context) => <MacroThemeCard context={context} observations={macroObservations} baselines={baselinesBySeries} expanded={expandedMacroTheme === context.id} onToggle={() => setExpandedMacroTheme(expandedMacroTheme === context.id ? null : context.id)} key={context.id} />) : <EmptyPanelNote label="observasi makro" />}</section></div></>}
      {activeMenu === "crypto" && <>
        <div className="page-intro"><span>CRYPTO</span><h1>Harga, likuiditas, dan arus modal</h1><p>Urutannya sederhana: lihat harga pasar, lalu ukuran likuiditas stablecoin, lalu arus ETF Bitcoin. Berita ditempatkan setelah data utama.</p></div>
        <CryptoMarketPanel observations={observations} providerHealth={providerHealth} />
        <div className="decision-grid">
          <StablecoinLiquidityPanel data={data.stablecoinLiquidity} />
          <BtcEtfFlowPanel data={data.btcEtfFlow} />
        </div>
        {showNews(cryptoNews, "BERITA CRYPTO")}
      </>}
      {activeMenu === "gold" && <>
        <div className="page-intro"><span>GOLD</span><h1>Harga dan posisi trader</h1><p>Harga menjawab apa yang diperdagangkan sekarang. CFTC menjawab bagaimana kelompok Managed Money memegang kontrak pada laporan mingguan terakhir.</p></div>
        <div className="decision-grid">
          <GoldPricePanel observations={observations} />
          <GoldPositioningPanel data={data.goldPositioning} />
        </div>
      </>}
      {activeMenu === "context" && <div className="menu-grid context-menu"><section className="panel intelligence-panel"><div className="panel-label"><span>MARKET CONTEXT</span><span>{contexts.length} CONTEXT</span></div><h2>Konteks pasar</h2><p className="lead-copy">Bagian ini mengelompokkan data dan event yang saling terkait. Gunakan jika ingin menelusuri detail di balik ringkasan.</p><div className="context-groups">{contextGroups.length ? contextGroups.map((group) => { const isExpanded = expandedGroup === group.id; return <section className={`context-group${isExpanded ? " expanded" : ""}`} key={group.id}><button type="button" className="context-group-button" aria-expanded={isExpanded} onClick={() => setExpandedGroup(isExpanded ? null : group.id)}><span><small>CONTEXT GROUP</small><strong>{group.label}</strong></span><span>{group.contexts.length} CONTEXT {isExpanded ? "↑" : "→"}</span></button>{isExpanded && <div className="context-list">{group.contexts.map((context) => { const label = context.scope === "CRYPTO_MARKET" ? context.id.replace("context-crypto-", "").toUpperCase() : context.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[context.scope] ?? context.scope.replaceAll("MACRO_", "").replaceAll("_", " "); return <ContextCard context={context} label={label} selected={selectedContextId === context.id} onClick={() => setSelectedContextId(selectedContextId === context.id ? null : context.id)} key={context.id} />; })}</div>}</section>; }) : <EmptyPanelNote label="context" />}</div></section>{selectedContext ? <ContextDetail context={selectedContext} label={selectedLabel} /> : <section className="panel context-detail-empty"><div className="panel-label"><span>RINCIAN KONTEKS</span><span>PILIH KONTEKS</span></div><h2>Pilih context</h2><p className="lead-copy">Klik salah satu konteks untuk melihat data dan event yang terkait.</p></section>}</div>}
      {activeMenu === "evidence" && <div className="menu-grid"><section className="panel intelligence-panel"><div className="panel-label"><span>EVIDENCE</span><span>{evidence.length} ITEM</span></div><h2>Jejak sumber data</h2><p className="lead-copy">Daftar sumber data yang dipakai P365. Bagian ini untuk audit dan penelusuran, bukan tampilan utama untuk mengambil keputusan.</p><div className="monitor-list">{evidence.length ? evidence.slice(0, 24).map((item: Evidence) => <div key={item.id}><strong>{item.kind}</strong><span>{item.subject} · {item.sourceId} · {relativeTimeID(item.capturedAt)}</span></div>) : <EmptyPanelNote label="evidence" />}</div></section></div>}
    </div>
  </main>;
}

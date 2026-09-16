"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { relativeTimeID } from "@/lib/data/format";
import type { DashboardData } from "@/lib/data/dashboard-data";
import type { CalendarEvent, NewsItem } from "@/lib/data/types";
import type { Context, DataQuality, Evidence, Observation, ProviderHealth } from "@/lib/domain/types";
import { buildBaselinePresentations, type BaselinePresentation } from "@/lib/presentation/baseline";
import { logout, refreshDashboardData } from "./actions";

type Menu = "overview" | "macro" | "crypto" | "context" | "intelligence" | "evidence";
const menuItems: { id: Menu; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "macro", label: "Macro" },
  { id: "crypto", label: "Crypto" },
  { id: "context", label: "Context" },
  { id: "intelligence", label: "Intelligence" },
  { id: "evidence", label: "Evidence" },
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

type ContextGroup = { id: string; label: string; contexts: Context[] };

type CryptoMetric = {
  id: string;
  label: string;
  value: number;
  unit: "USD" | "PERCENT";
  observedAt: string;
  quality: DataQuality;
};

function StatusBadge({ value }: { value: "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" }) {
  const labels = { PENDING: "BELUM ADA", FRESH: "TERBARU", PARTIAL: "SEBAGIAN", UNAVAILABLE: "TIDAK TERSEDIA" };
  return <span className={`status-badge ${value.toLowerCase()}`}>{labels[value]}</span>;
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

function formatBaselineDelta(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatMacroValue(value: string, unit: string): string {
  const normalized = unit.trim().toLowerCase();
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (normalized.includes("percent") || normalized === "%") return `${numeric.toFixed(2)}%`;
  if (normalized.includes("dollar") || normalized.includes("usd") || normalized.includes("$") ) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(numeric);
  }
  return value;
}

function MacroObservationRow({ item, baseline }: { item: Observation; baseline: BaselinePresentation | null }) {
  const metadata = item.metadata ?? {};
  const unit = String(metadata.unit ?? "");
  const delta = baseline?.changeValue ?? null;
  return <article className="calendar-row">
    <div className="macro-tile-header"><span className="macro-frequency">{String(metadata.frequency ?? "UNKNOWN")}</span><span className="macro-quality">{item.quality}</span></div>
    <div className="macro-tile-main"><h3>{item.subject}</h3><strong className="macro-value">{formatMacroValue(item.value, unit)}</strong></div>
    <div className="macro-tile-footer"><span>{String(metadata.seriesId ?? "")}</span><span>{baseline?.baselineValue !== null && baseline?.baselineValue !== undefined ? `Ref ${formatMacroValue(baseline.baselineValue, unit)} · Δ ${formatBaselineDelta(delta)}` : `Ref ${baseline?.status ?? "MISSING"}`}</span></div>
  </article>;
}

function ContextCard({ context, label, selected, onClick }: { context: Context; label: string; selected: boolean; onClick: () => void }) {
  return <button type="button" className={`context-card context-card-button${selected ? " selected" : ""}`} aria-pressed={selected} onClick={onClick}><div className="context-card-head"><span className="context-scope">{label}</span><span className="context-count">{context.observationIds.length} OBS · {context.eventIds.length} EVENT</span></div><h3>{context.statement}</h3><p>Traceable ke canonical observation/event. Klik untuk membuka detail context.</p></button>;
}

function ContextDetail({ context, label }: { context: Context; label: string }) {
  return <section className="panel context-detail"><div className="panel-label"><span>CONTEXT DETAIL</span><span>{label}</span></div><h2>{context.statement}</h2><p className="lead-copy">Context hanya mengelompokkan evidence yang sudah ada. Layer ini tidak menghasilkan arah pasar, regime, sentiment, liquidity, capital flow, atau risk.</p><div className="monitor-list"><div><strong>SCOPE</strong><span>{context.scope}</span></div><div><strong>OBSERVATIONS</strong><span>{context.observationIds.length ? context.observationIds.join(" · ") : "Tidak ada"}</span></div><div><strong>EVENTS</strong><span>{context.eventIds.length ? context.eventIds.join(" · ") : "Tidak ada"}</span></div><div><strong>CREATED</strong><span>{relativeTimeID(context.createdAt)}</span></div></div></section>;
}

function observationStatus(qualities: DataQuality[]): "PENDING" | "FRESH" | "PARTIAL" {
  return qualities.length === 0 ? "PENDING" : qualities.every((item) => item === "FRESH") ? "FRESH" : "PARTIAL";
}

function sourceStatus(health: ProviderHealth[]): "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" {
  if (!health.length) return "PENDING";
  if (health.some((item) => item.status === "ERROR" || item.status === "UNAVAILABLE")) return "UNAVAILABLE";
  if (health.some((item) => item.status === "STALE")) return "PARTIAL";
  return health.some((item) => item.status === "EMPTY") ? "PENDING" : "FRESH";
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
  return <article className="panel" style={{ margin: 0 }}><div className="panel-label"><span>{metric.label}</span><span>{metric.quality}</span></div><strong style={{ display: "block", fontSize: "clamp(1.45rem, 3vw, 2.2rem)", lineHeight: 1.05, letterSpacing: "-0.03em", marginTop: "0.45rem" }}>{metric.unit === "USD" ? formatMoney(metric.value) : formatPercent(metric.value)}</strong><p className="muted" style={{ marginBottom: 0 }}>CoinGecko · {relativeTimeID(metric.observedAt)}</p></article>;
}

function CryptoMarketPanel({ observations, providerHealth }: { observations: Observation[]; providerHealth: ProviderHealth[] }) {
  const metrics = buildCryptoMetrics(observations);
  const coinGeckoHealth = providerHealth.find((item) => item.sourceId === "coingecko-market");
  const quality = observationStatus(metrics.map((metric) => metric.quality));

  return <section className="panel" aria-labelledby="crypto-foundation-title" style={{ marginTop: "1.25rem" }}>
    <div className="panel-label"><span>CRYPTO MARKET FOUNDATION</span><StatusBadge value={quality} /></div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
      <div><h2 id="crypto-foundation-title" style={{ marginBottom: "0.35rem" }}>Market data from CoinGecko</h2><p className="lead-copy" style={{ marginBottom: 0 }}>Canonical market observations exposed directly in the UI. No regime or trading inference is applied here.</p></div>
      <span className="muted">Provider: {coinGeckoHealth?.status ?? "UNKNOWN"} · {coinGeckoHealth?.itemCount ?? 0} observations</span>
    </div>
    {metrics.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>{metrics.map((metric) => <CryptoMetricCard key={metric.id} metric={metric} />)}</div> : <EmptyPanelNote label="crypto market" />}
  </section>;
}

function OverviewWhatChanged({ observations, baselines }: { observations: Observation[]; baselines: BaselinePresentation[] }) {
  const validChanges = baselines.filter((item) => item.status === "VALID" && item.changeValue !== null);
  const staleBaselines = baselines.filter((item) => item.status === "STALE");
  return <section className="panel overview-change-layer" aria-labelledby="what-changed-title">
    <div className="panel-label"><span>02 / WHAT CHANGED</span><span>FACTUAL BASELINE</span></div>
    <div className="change-layer-grid">
      <div>
        <h2 id="what-changed-title">Perubahan faktual tersedia untuk {validChanges.length} seri.</h2>
        <p className="lead-copy">Layer ini hanya membandingkan observasi terbaru dengan factual baseline yang valid. Delta tidak diterjemahkan menjadi arah pasar, regime, surprise, atau implikasi trading.</p>
      </div>
      <div className="state-meta">
        <div><span>OBSERVASI TERSEDIA</span><strong>{observations.length}</strong></div>
        <div><span>BASELINE VALID</span><strong>{validChanges.length}</strong></div>
        <div><span>BASELINE STALE</span><strong>{staleBaselines.length}</strong></div>
        <div><span>STATUS</span><strong>{baselines.length ? "FACTUAL ONLY" : "NO BASELINE"}</strong></div>
      </div>
    </div>
    {validChanges.length > 0 && <div className="monitor-list" style={{ marginTop: "1rem" }}>{validChanges.slice(0, 6).map((item) => <div key={item.seriesId}><strong>{item.seriesId}</strong><span>{item.currentValue} vs {item.baselineValue} · Δ {formatBaselineDelta(item.changeValue)}</span></div>)}</div>}
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
    {selectedContext ? <ContextDetail context={selectedContext} label={selectedContext.scope === "CRYPTO_MARKET" ? selectedContext.id.replace("context-crypto-", "").toUpperCase() : selectedContext.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[selectedContext.scope] ?? selectedContext.scope.replaceAll("MACRO_", "").replaceAll("_", " ")} /> : <div className="context-detail-empty"><div className="panel-label"><span>CONTEXT DETAIL</span><span>WAITING</span></div><h3>Select a context</h3><p className="lead-copy">Pilih context untuk melihat hubungan langsungnya ke canonical observation/event.</p></div>}
  </section>;
}

function observationStatus(qualities: DataQuality[]): "PENDING" | "FRESH" | "PARTIAL" {
  return qualities.length === 0 ? "PENDING" : qualities.every((item) => item === "FRESH") ? "FRESH" : "PARTIAL";
}

function sourceStatus(health: ProviderHealth[]): "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" {
  if (!health.length) return "PENDING";
  if (health.some((item) => item.status === "ERROR" || item.status === "UNAVAILABLE")) return "UNAVAILABLE";
  if (health.some((item) => item.status === "STALE")) return "PARTIAL";
  return health.some((item) => item.status === "EMPTY") ? "PENDING" : "FRESH";
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
  return <article className="panel" style={{ margin: 0 }}><div className="panel-label"><span>{metric.label}</span><span>{metric.quality}</span></div><strong style={{ display: "block", fontSize: "clamp(1.45rem, 3vw, 2.2rem)", lineHeight: 1.05, letterSpacing: "-0.03em", marginTop: "0.45rem" }}>{metric.unit === "USD" ? formatMoney(metric.value) : formatPercent(metric.value)}</strong><p className="muted" style={{ marginBottom: 0 }}>CoinGecko · {relativeTimeID(metric.observedAt)}</p></article>;
}

function CryptoMarketPanel({ observations, providerHealth }: { observations: Observation[]; providerHealth: ProviderHealth[] }) {
  const metrics = buildCryptoMetrics(observations);
  const coinGeckoHealth = providerHealth.find((item) => item.sourceId === "coingecko-market");
  const quality = observationStatus(metrics.map((metric) => metric.quality));

  return <section className="panel" aria-labelledby="crypto-foundation-title" style={{ marginTop: "1.25rem" }}>
    <div className="panel-label"><span>CRYPTO MARKET FOUNDATION</span><StatusBadge value={quality} /></div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
      <div><h2 id="crypto-foundation-title" style={{ marginBottom: "0.35rem" }}>Market data from CoinGecko</h2><p className="lead-copy" style={{ marginBottom: 0 }}>Canonical market observations exposed directly in the UI. No regime or trading inference is applied here.</p></div>
      <span className="muted">Provider: {coinGeckoHealth?.status ?? "UNKNOWN"} · {coinGeckoHealth?.itemCount ?? 0} observations</span>
    </div>
    {metrics.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>{metrics.map((metric) => <CryptoMetricCard key={metric.id} metric={metric} />)}</div> : <EmptyPanelNote label="crypto market" />}
  </section>;
}

function OverviewWhatChanged({ observations, baselines }: { observations: Observation[]; baselines: BaselinePresentation[] }) {
  const validChanges = baselines.filter((item) => item.status === "VALID" && item.changeValue !== null);
  const staleBaselines = baselines.filter((item) => item.status === "STALE");
  return <section className="panel overview-change-layer" aria-labelledby="what-changed-title">
    <div className="panel-label"><span>02 / WHAT CHANGED</span><span>FACTUAL BASELINE</span></div>
    <div className="change-layer-grid">
      <div>
        <h2 id="what-changed-title">Perubahan faktual tersedia untuk {validChanges.length} seri.</h2>
        <p className="lead-copy">Layer ini hanya membandingkan observasi terbaru dengan factual baseline yang valid. Delta tidak diterjemahkan menjadi arah pasar, regime, surprise, atau implikasi trading.</p>
      </div>
      <div className="state-meta">
        <div><span>OBSERVASI TERSEDIA</span><strong>{observations.length}</strong></div>
        <div><span>BASELINE VALID</span><strong>{validChanges.length}</strong></div>
        <div><span>BASELINE STALE</span><strong>{staleBaselines.length}</strong></div>
        <div><span>STATUS</span><strong>{baselines.length ? "FACTUAL ONLY" : "NO BASELINE"}</strong></div>
      </div>
    </div>
    {validChanges.length > 0 && <div className="monitor-list" style={{ marginTop: "1rem" }}>{validChanges.slice(0, 6).map((item) => <div key={item.seriesId}><strong>{item.seriesId}</strong><span>{item.currentValue} vs {item.baselineValue} · Δ {formatBaselineDelta(item.changeValue)}</span></div>)}</div>}
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
    {selectedContext ? <ContextDetail context={selectedContext} label={selectedContext.scope === "CRYPTO_MARKET" ? selectedContext.id.replace("context-crypto-", "").toUpperCase() : selectedContext.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[selectedContext.scope] ?? selectedContext.scope.replaceAll("MACRO_", "").replaceAll("_", " ")} /> : <div className="context-detail-empty"><div className="panel-label"><span>CONTEXT DETAIL</span><span>WAITING</span></div><h3>Select a context</h3><p className="lead-copy">Pilih context untuk melihat hubungan langsungnya ke canonical observation/event.</p></div>}
  </section>;
}

export function DashboardView({ data, sessionEmail }: { data: DashboardData; sessionEmail: string }) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<Menu>("overview");
  const [isRefreshing, startRefresh] = useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  useEffect(() => { setLastRefreshedAt(new Date().toISOString()); }, []);
  const baselinePresentations = buildBaselinePresentations(data.macroBaselines);
  const baselinesBySeries = new Map(baselinePresentations.map((item) => [item.seriesId, item]));
  const contextGroups = Object.entries(data.contexts.reduce<Record<string, Context[]>>((groups, context) => { const key = context.scope === "CRYPTO_MARKET" ? "CRYPTO MARKET" : context.scope === "ECONOMIC_EVENTS" ? "ECONOMIC EVENTS" : "MACRO"; (groups[key] ??= []).push(context); return groups; }, {})).map(([id, contexts]) => ({ id, label: id, contexts }));
  const selectedContext = data.contexts.find((context) => context.id === selectedContextId) ?? null;
  const macroSeries = data.macroObservations;
  return <div className="dashboard-shell">
    <header className="topbar"><div className="topbar-brand-group"><button className="nav-toggle" type="button" aria-label="Open navigation" aria-expanded={false}><span /><span /><span /></button><strong>P365</strong></div><nav className="topbar-actions">{menuItems.map((item) => <button key={item.id} type="button" className={activeMenu === item.id ? "active" : ""} onClick={() => setActiveMenu(item.id)}>{item.label}</button>)}</nav><span className="refresh-note">{lastRefreshedAt ? `Updated ${relativeTimeID(lastRefreshedAt)}` : "Updating"}</span></header>
    <main className="dashboard-content">
      {activeMenu === "macro" ? <section className="menu-grid"><div className="calendar"><div className="panel-label"><span>MACRO OBSERVATIONS</span><span>{macroSeries.length} ITEMS · {baselinePresentations.length} BASELINES</span></div><h2>Macro market context</h2><p className="muted">Canonical macro observations only. Cross-asset observations remain outside this view.</p>{macroSeries.length ? macroSeries.map((item) => <MacroObservationRow key={item.id} item={item} baseline={baselinesBySeries.get(String(item.metadata?.seriesId ?? "")) ?? null} />) : <EmptyPanelNote label="macro observations" />}</div></section> : activeMenu === "crypto" ? <CryptoMarketPanel observations={data.observations} providerHealth={data.providerHealth} /> : activeMenu === "context" ? <OverviewContext contextGroups={contextGroups} selectedContextId={selectedContextId} selectedContext={selectedContext} onSelect={setSelectedContextId} /> : activeMenu === "overview" ? <><OverviewWhatChanged observations={macroSeries} baselines={baselinePresentations} /><OverviewContext contextGroups={contextGroups} selectedContextId={selectedContextId} selectedContext={selectedContext} onSelect={setSelectedContextId} /></> : <section className="panel"><h2>{menuItems.find((item) => item.id === activeMenu)?.label}</h2><EmptyPanelNote label={activeMenu} /></section>}
    </main>
  </div>;
}

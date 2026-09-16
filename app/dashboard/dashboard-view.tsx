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
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const normalized = unit.trim().toLowerCase();
  if (normalized.includes("percent") || normalized === "%") return `${numeric.toFixed(2)}%`;
  if (normalized.includes("dollar") || normalized.includes("usd") || normalized.includes("$") ) {
    const absolute = Math.abs(numeric);
    if (absolute >= 1_000_000_000_000) return `$${(numeric / 1_000_000_000_000).toFixed(2)}T`;
    if (absolute >= 1_000_000_000) return `$${(numeric / 1_000_000_000).toFixed(2)}B`;
    if (absolute >= 1_000_000) return `$${(numeric / 1_000_000).toFixed(2)}M`;
    if (absolute >= 1_000) return `$${(numeric / 1_000).toFixed(2)}K`;
    return `$${numeric.toFixed(2)}`;
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

export function DashboardView({ data, sessionEmail }: { data: DashboardData; sessionEmail: string }) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<Menu>("overview");
  const [isRefreshing, startRefresh] = useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { macroNews, cryptoNews, calendarEvents, calendarProviderMessage, unavailableSources, observations, macroObservations, macroBaselines, contexts, evidence, providerHealth } = data;
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

  const marketStatus = observationStatus(observations.map((item) => item.quality));
  const providerStatus = sourceStatus(providerHealth);
  const highImpactEvents = calendarEvents.filter((item) => item.impact === "HIGH").length;
  const cryptoContexts = contexts.filter((context) => context.scope === "CRYPTO_MARKET");
  const macroContexts = contexts.filter((context) => context.scope.startsWith("MACRO_"));
  const economicEventContexts = contexts.filter((context) => context.scope === "ECONOMIC_EVENTS");
  const contextGroups: ContextGroup[] = [{ id: "crypto", label: "CRYPTO MARKET", contexts: cryptoContexts }, { id: "macro", label: "MACRO", contexts: macroContexts }, { id: "events", label: "ECONOMIC EVENTS", contexts: economicEventContexts }].filter((group) => group.contexts.length > 0);
  const selectedContext = contexts.find((context) => context.id === selectedContextId) ?? null;
  const selectedLabel = selectedContext ? selectedContext.scope === "CRYPTO_MARKET" ? selectedContext.id.replace("context-crypto-", "").toUpperCase() : selectedContext.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[selectedContext.scope] ?? selectedContext.scope.replaceAll("MACRO_", "").replaceAll("_", " ") : "";
  const showNews = (items: NewsItem[], label: string) => <section className="panel news-panel"><div className="panel-label"><span>{label}</span><span>{items.length} ITEM</span></div><h2>Evidence berita terbaru</h2><div className="news-list">{items.length ? items.map((item) => <NewsCard item={item} key={item.id} />) : <EmptyPanelNote label={label.toLowerCase()} />}</div></section>;

  return <main className="dashboard-shell">
    <header className="topbar"><div className="topbar-brand-group"><button className="nav-toggle" type="button" aria-label={navOpen ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={navOpen} aria-controls="dashboard-navigation" onClick={() => setNavOpen((open) => !open)}><span /><span /><span /></button><div className="brand-lockup"><img className="brand-logo" src="/project365-logo.svg" alt="PROJECT365" style={{ width: "clamp(1.05rem, 2.2vw, 1.45rem)", height: "clamp(1.05rem, 2.2vw, 1.45rem)", objectFit: "contain", flexShrink: 0 }} /><p className="eyebrow" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", lineHeight: 1, letterSpacing: "-0.02em", margin: 0 }}>PROJECT365</p></div></div><div className="topbar-actions"><p><span className={`live-dot ${providerStatus === "UNAVAILABLE" ? "warning" : ""}`} /> {providerStatus === "FRESH" ? "DATA SEHAT" : "PERLU PERHATIAN"}</p>{lastRefreshedAt && <p className="muted refresh-note">Refresh manual terakhir: {relativeTimeID(lastRefreshedAt)}</p>}<button className="refresh-btn" type="button" onClick={handleManualRefresh} disabled={isRefreshing} aria-busy={isRefreshing}>{isRefreshing ? "Memuat ulang…" : "Muat ulang manual"}</button><div style={{ position: "relative" }}><button type="button" aria-label="Buka menu akun" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)} style={{ width: 36, height: 36, display: "grid", placeItems: "center", padding: 0, border: "1px solid var(--line)", borderRadius: 4, background: accountOpen ? "#151d19" : "transparent", color: accountOpen ? "var(--lime)" : "var(--text)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.7-3.5 3-5.3 6.5-5.3s5.8 1.8 6.5 5.3" /></svg></button>{accountOpen && <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 220, padding: 8, border: "1px solid var(--line)", borderRadius: 5, background: "#101513", boxShadow: "0 12px 30px rgba(0,0,0,.35)", zIndex: 60 }}><div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--line)" }}><span style={{ display: "block", color: "var(--muted)", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: ".08em" }}>AKUN</span><strong style={{ display: "block", marginTop: 5, fontSize: 12, overflowWrap: "anywhere" }}>{sessionEmail}</strong></div><form action={logout}><button type="submit" style={{ width: "100%", marginTop: 8, padding: "9px 10px", textAlign: "left", border: "1px solid var(--line)", borderRadius: 4, background: "transparent", color: "var(--text)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Keluar</button></form></div>}</div></div></header>
    {navOpen && <button className="nav-backdrop" type="button" aria-label="Tutup navigasi" onClick={() => setNavOpen(false)} />}
    <nav id="dashboard-navigation" className={`filters${navOpen ? " open" : ""}`} aria-label="Bagian dashboard" role="tablist">{menuItems.map((item) => <button key={item.id} type="button" role="tab" aria-selected={activeMenu === item.id} className={activeMenu === item.id ? "active" : ""} onClick={() => { setActiveMenu(item.id); setNavOpen(false); }}>{item.label}</button>)}<span>WIB / ASIA-JAKARTA</span></nav>

    <div className="dashboard-content" role="tabpanel">
      {activeMenu === "overview" && <><section className="market-state panel" aria-labelledby="state-title"><div className="panel-label"><span>01 / STATUS PASAR GLOBAL</span><StatusBadge value="PENDING" /></div><div className="state-grid"><div><h2 id="state-title">Belum ada kesimpulan status pasar.</h2><p>{observations.length ? "Observasi pasar tersedia, tetapi P365 belum memiliki aturan domain spesifik untuk menggabungkannya menjadi satu status pasar." : "Tidak ada observasi pasar yang dapat diverifikasi pada request ini, sehingga P365 tidak menampilkan status pasar."}</p></div><div className="state-meta"><div><span>CONFIDENCE</span><strong>BELUM ADA</strong></div><div><span>OBSERVASI</span><strong>{observations.length} · {marketStatus}</strong></div><div><span>EVIDENCE KANONIK</span><strong>{evidence.length} item</strong></div><div><span>EVENT MENDATANG</span><strong>{calendarEvents.length}</strong></div></div></div></section><OverviewWhatChanged observations={observations} baselines={baselinePresentations} /><OverviewContext contextGroups={contextGroups} selectedContextId={selectedContextId} selectedContext={selectedContext} onSelect={(id) => setSelectedContextId(selectedContextId === id ? null : id)} /><section className="overview-grid"><section className="panel market-watch"><div className="panel-label"><span>CAKUPAN DOMAIN</span><span>RINGKASAN</span></div><h2>Cakupan data</h2>{[["Evidence berita makro", macroNews.length, macroNews.length ? "FRESH" : "PENDING"], ["Evidence berita crypto", cryptoNews.length, cryptoNews.length ? "FRESH" : "PENDING"], ["Observasi pasar", observations.length, marketStatus], ["Provider", providerHealth.length, providerStatus]].map(([label, count, status]) => <div className="watch-row" key={String(label)}><span>{label}</span><strong>{count}</strong><StatusBadge value={status as "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE"} /></div>)}</section><section className="panel calendar"><div className="panel-label"><span>EVENT MENDATANG</span><span>{calendarEvents.length} ITEM</span></div><h2>Agenda penting</h2>{calendarEvents.length ? calendarEvents.map((item) => <CalendarRow item={item} key={item.id} />) : <><EmptyPanelNote label="kalender ekonomi" />{calendarProviderMessage && <p className="muted">Diagnostic Forex Factory: {calendarProviderMessage}</p>}</>}</section></section></>}
      {activeMenu === "macro" && <div className="menu-grid">{showNews(macroNews, "BERITA MAKRO")}<section className="panel calendar"><div className="panel-label"><span>OBSERVASI MAKRO</span><span>{macroObservations.length} ITEM · {baselinePresentations.length} BASELINE</span></div><h2>Monitor data makro</h2>{macroObservations.length ? macroObservations.map((item) => <MacroObservationRow item={item} baseline={baselinesBySeries.get(String(item.metadata?.seriesId ?? "")) ?? null} key={item.id} />) : <EmptyPanelNote label="observasi makro" />}</section></div>}
      {activeMenu === "crypto" && <div className="menu-grid"><CryptoMarketPanel observations={observations} providerHealth={providerHealth} />{showNews(cryptoNews, "BERITA CRYPTO")}</div>}
      {activeMenu === "context" && <div className="menu-grid context-menu"><section className="panel intelligence-panel"><div className="panel-label"><span>MARKET CONTEXT</span><span>{contexts.length} CONTEXT</span></div><h2>Context explorer</h2><p className="lead-copy">Context adalah layer pengelompokan evidence. Pilih grup untuk membuka context di dalamnya, lalu klik context untuk melihat traceability.</p><div className="context-groups">{contextGroups.length ? contextGroups.map((group) => { const isExpanded = expandedGroup === group.id; return <section className={`context-group${isExpanded ? " expanded" : ""}`} key={group.id}><button type="button" className="context-group-button" aria-expanded={isExpanded} onClick={() => setExpandedGroup(isExpanded ? null : group.id)}><span><small>CONTEXT GROUP</small><strong>{group.label}</strong></span><span>{group.contexts.length} CONTEXT {isExpanded ? "↑" : "→"}</span></button>{isExpanded && <div className="context-list">{group.contexts.map((context) => { const label = context.scope === "CRYPTO_MARKET" ? context.id.replace("context-crypto-", "").toUpperCase() : context.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[context.scope] ?? context.scope.replaceAll("MACRO_", "").replaceAll("_", " "); return <ContextCard context={context} label={label} selected={selectedContextId === context.id} onClick={() => setSelectedContextId(selectedContextId === context.id ? null : context.id)} key={context.id} />; })}</div>}</section>; }) : <EmptyPanelNote label="context" />}</div></section>{selectedContext ? <ContextDetail context={selectedContext} label={selectedLabel} /> : <section className="panel context-detail-empty"><div className="panel-label"><span>CONTEXT DETAIL</span><span>WAITING</span></div><h2>Pilih context</h2><p className="lead-copy">Klik salah satu context untuk membuka detail dan melihat hubungan langsungnya ke canonical observation/event.</p></section>}</div>}
      {activeMenu === "intelligence" && <div className="menu-grid"><section className="panel intelligence-panel"><div className="panel-label"><span>INTELLIGENCE</span><span>SEMANTIC LAYER</span></div><h2>Intelligence yang terverifikasi</h2><p className="lead-copy">Intelligence akan menjelaskan WHAT, WHY, evidence yang mengonfirmasi atau bertentangan, invalidation, monitoring, dan confidence. Context tidak ditampilkan sebagai intelligence.</p><div className="monitor-list"><div><strong>Context</strong><span>Dipisahkan ke menu Context sebagai canonical grouping layer.</span></div><div><strong>Evidence</strong><span>{evidence.length} evidence canonical tersedia sebagai dasar reasoning.</span></div><div><strong>Inference</strong><span>Belum ada kesimpulan regime, sentiment, liquidity, capital flow, atau price prediction.</span></div></div></section><section className="panel"><div className="panel-label"><span>MONITOR</span><span>STATUS OPERASIONAL</span></div><h2>Apa yang perlu dipantau?</h2><div className="monitor-list"><div><strong>Observasi pasar</strong><span>{observations.length} observasi · kualitas {marketStatus}.</span></div><div><strong>Event makro</strong><span>{highImpactEvents} event berdampak tinggi terdeteksi.</span></div><div><strong>Provider</strong><span>{providerHealth.length} provider terdaftar · status {providerStatus}.</span></div><div><strong>Unavailable</strong><span>{unavailableSources.length ? unavailableSources.join(" · ") : "Tidak ada provider yang ditandai unavailable."}</span></div></div></section></div>}
      {activeMenu === "evidence" && <div className="menu-grid"><section className="panel intelligence-panel"><div className="panel-label"><span>EVIDENCE</span><span>{evidence.length} ITEM</span></div><h2>Canonical evidence</h2><p className="lead-copy">Evidence adalah bahan yang dapat ditelusuri kembali ke source. P365 tidak mengubah evidence menjadi kesimpulan otomatis.</p><div className="monitor-list">{evidence.length ? evidence.slice(0, 24).map((item: Evidence) => <div key={item.id}><strong>{item.kind}</strong><span>{item.subject} · {item.sourceId} · {relativeTimeID(item.capturedAt)}</span></div>) : <EmptyPanelNote label="evidence" />}</div></section></div>}
    </div>
  </main>;
}

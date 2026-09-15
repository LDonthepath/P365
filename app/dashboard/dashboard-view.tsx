"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { relativeTimeID } from "@/lib/data/format";
import type { DashboardData } from "@/lib/data/dashboard-data";
import type { CalendarEvent, NewsItem } from "@/lib/data/types";
import type { Context, DataQuality, Observation, ProviderHealth } from "@/lib/domain/types";
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

function StatusBadge({ value }: { value: "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" }) {
  const labels = { PENDING: "BELUM ADA", FRESH: "TERBARU", PARTIAL: "SEBAGIAN", UNAVAILABLE: "TIDAK TERSEDIA" };
  return <span className={`status-badge ${value.toLowerCase()}`}>{labels[value]}</span>;
}
function EmptyPanelNote({ label }: { label: string }) { return <p className="muted">Data {label} belum tersedia saat ini. Coba muat ulang beberapa saat lagi.</p>; }
function NewsCard({ item }: { item: NewsItem }) { return <article className="evidence-item"><div className="card-meta"><span>{item.category}</span><span>{item.source} · {relativeTimeID(item.publishedAt)}</span></div><h3>{item.title}</h3><p>{item.summary}</p><a className="text-link" href={item.url} target="_blank" rel="noreferrer">Baca sumber ↗</a></article>; }
function CalendarRow({ item }: { item: CalendarEvent }) { return <article className="calendar-row"><time dateTime={item.dateISO} aria-label={`${item.event}, ${item.status}, ${item.time} WIB`}>{item.time}<small>WIB</small></time><div><h3>{item.event}</h3><p>{item.country} · {item.status}</p></div><span className={`impact ${item.impact.toLowerCase()}`}>{item.impact}</span></article>; }
function MacroObservationRow({ item }: { item: Observation }) { const metadata = item.metadata ?? {}; return <article className="calendar-row"><time dateTime={item.observedAt}>{String(metadata.frequency ?? "UNKNOWN")}<small>{item.quality}</small></time><div><h3>{item.subject}</h3><p>{String(metadata.seriesId ?? "")} · observation date {String(metadata.observationDate ?? "unknown")}</p></div><span className="impact low">{item.value} {String(metadata.unit ?? "")}</span></article>; }
function ContextCard({ context, label, selected, onClick }: { context: Context; label: string; selected: boolean; onClick: () => void }) { return <button type="button" className={`context-card context-card-button${selected ? " selected" : ""}`} aria-pressed={selected} onClick={onClick}><div className="context-card-head"><span className="context-scope">{label}</span><span className="context-count">{context.observationIds.length} OBS · {context.eventIds.length} EVENT</span></div><h3>{context.statement}</h3><p>Traceable ke canonical observation/event. Klik untuk membuka detail context.</p></button>; }
function ContextDetail({ context, label }: { context: Context; label: string }) { return <section className="panel context-detail"><div className="panel-label"><span>CONTEXT DETAIL</span><span>{label}</span></div><h2>{context.statement}</h2><p className="lead-copy">Context hanya mengelompokkan evidence yang sudah ada. Layer ini tidak menghasilkan arah pasar, regime, sentiment, liquidity, capital flow, atau risk.</p><div className="monitor-list"><div><strong>SCOPE</strong><span>{context.scope}</span></div><div><strong>OBSERVATIONS</strong><span>{context.observationIds.length ? context.observationIds.join(" · ") : "Tidak ada"}</span></div><div><strong>EVENTS</strong><span>{context.eventIds.length ? context.eventIds.join(" · ") : "Tidak ada"}</span></div><div><strong>CREATED</strong><span>{relativeTimeID(context.createdAt)}</span></div></div></section>; }
function observationStatus(qualities: DataQuality[]): "PENDING" | "FRESH" | "PARTIAL" { return qualities.length === 0 ? "PENDING" : qualities.every((item) => item === "FRESH") ? "FRESH" : "PARTIAL"; }
function sourceStatus(health: ProviderHealth[]): "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" { if (!health.length) return "PENDING"; if (health.some((item) => item.status === "ERROR" || item.status === "UNAVAILABLE")) return "UNAVAILABLE"; if (health.some((item) => item.status === "STALE")) return "PARTIAL"; return health.some((item) => item.status === "EMPTY") ? "PENDING" : "FRESH"; }

export function DashboardView({ data, sessionEmail }: { data: DashboardData; sessionEmail: string }) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<Menu>("overview");
  const [isRefreshing, startRefresh] = useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const { macroNews, cryptoNews, calendarEvents, calendarProviderMessage, unavailableSources, observations, macroObservations, events, contexts, evidence, providerHealth } = data;

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
    <header className="topbar"><div><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">P</span><p className="eyebrow">P365 // MARKET INTELLIGENCE</p></div><h1>Market Intelligence<span>.</span></h1></div><div className="topbar-actions"><p><span className={`live-dot ${providerStatus === "UNAVAILABLE" ? "warning" : ""}`} /> {providerStatus === "FRESH" ? "DATA SEHAT" : "PERLU PERHATIAN"}</p>{lastRefreshedAt && <p className="muted refresh-note">Refresh manual terakhir: {relativeTimeID(lastRefreshedAt)}</p>}<button className="refresh-btn" type="button" onClick={handleManualRefresh} disabled={isRefreshing} aria-busy={isRefreshing}>{isRefreshing ? "Memuat ulang…" : "Muat ulang manual"}</button><form action={logout}><button className="logout" type="submit">Keluar</button></form></div></header>
    <nav className="filters" aria-label="Bagian dashboard" role="tablist">{menuItems.map((item) => <button key={item.id} type="button" role="tab" aria-selected={activeMenu === item.id} className={activeMenu === item.id ? "active" : ""} onClick={() => setActiveMenu(item.id)}>{item.label}</button>)}<span>WIB / ASIA-JAKARTA</span></nav>

    <div className="dashboard-content" role="tabpanel">
      {activeMenu === "overview" && <><section className="market-state panel" aria-labelledby="state-title"><div className="panel-label"><span>01 / STATUS PASAR GLOBAL</span><StatusBadge value="PENDING" /></div><div className="state-grid"><div><h2 id="state-title">Belum ada kesimpulan status pasar.</h2><p>{observations.length ? "Observasi pasar tersedia, tetapi P365 belum memiliki aturan domain spesifik untuk menggabungkannya menjadi satu status pasar." : "Tidak ada observasi pasar yang dapat diverifikasi pada request ini, sehingga P365 tidak menampilkan status pasar."}</p></div><div className="state-meta"><div><span>CONFIDENCE</span><strong>BELUM ADA</strong></div><div><span>OBSERVASI</span><strong>{observations.length} · {marketStatus}</strong></div><div><span>EVIDENCE KANONIK</span><strong>{evidence.length} item</strong></div><div><span>EVENT MENDATANG</span><strong>{calendarEvents.length}</strong></div></div></div></section><section className="overview-grid"><section className="panel market-watch"><div className="panel-label"><span>CAKUPAN DOMAIN</span><span>RINGKASAN</span></div><h2>Cakupan data</h2>{[["Evidence berita makro", macroNews.length, macroNews.length ? "FRESH" : "PENDING"], ["Evidence berita crypto", cryptoNews.length, cryptoNews.length ? "FRESH" : "PENDING"], ["Observasi pasar", observations.length, marketStatus], ["Provider", providerHealth.length, providerStatus]].map(([label, count, status]) => <div className="watch-row" key={String(label)}><span>{label}</span><strong>{count}</strong><StatusBadge value={status as "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE"} /></div>)}</section><section className="panel calendar"><div className="panel-label"><span>EVENT MENDATANG</span><span>{calendarEvents.length} ITEM</span></div><h2>Agenda penting</h2>{calendarEvents.length ? calendarEvents.map((item) => <CalendarRow item={item} key={item.id} />) : <><EmptyPanelNote label="kalender ekonomi" />{calendarProviderMessage && <p className="muted">Diagnostic Forex Factory: {calendarProviderMessage}</p>}</>}</section></section></>}
      {activeMenu === "macro" && <div className="menu-grid">{showNews(macroNews, "BERITA MAKRO")}<section className="panel calendar"><div className="panel-label"><span>OBSERVASI MAKRO</span><span>{macroObservations.length} ITEM</span></div><h2>Monitor data makro</h2>{macroObservations.length ? macroObservations.map((item) => <MacroObservationRow item={item} key={item.id} />) : <EmptyPanelNote label="observasi makro" />}</section></div>}
      {activeMenu === "crypto" && <div className="menu-grid">{showNews(cryptoNews, "BERITA CRYPTO")}<section className="panel"><div className="panel-label"><span>OBSERVASI PASAR</span><StatusBadge value={marketStatus} /></div><h2>Crypto market watch</h2><div className="monitor-list"><div><strong>Observasi kanonik</strong><span>{observations.length} observasi pasar tersedia.</span></div><div><strong>Kualitas data</strong><span>Status observasi saat ini: {marketStatus}.</span></div></div></section></div>}
      {activeMenu === "context" && <div className="menu-grid context-menu"><section className="panel intelligence-panel"><div className="panel-label"><span>MARKET CONTEXT</span><span>{contexts.length} CONTEXT</span></div><h2>Context explorer</h2><p className="lead-copy">Context adalah layer pengelompokan evidence. Pilih grup untuk membuka context di dalamnya, lalu klik context untuk melihat traceability.</p><div className="context-groups">{contextGroups.length ? contextGroups.map((group) => { const isExpanded = expandedGroup === group.id; return <section className={`context-group${isExpanded ? " expanded" : ""}`} key={group.id}><button type="button" className="context-group-button" aria-expanded={isExpanded} onClick={() => setExpandedGroup(isExpanded ? null : group.id)}><span><small>CONTEXT GROUP</small><strong>{group.label}</strong></span><span>{group.contexts.length} CONTEXT {isExpanded ? "↑" : "→"}</span></button>{isExpanded && <div className="context-list">{group.contexts.map((context) => { const label = context.scope === "CRYPTO_MARKET" ? context.id.replace("context-crypto-", "").toUpperCase() : context.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[context.scope] ?? context.scope.replaceAll("MACRO_", "").replaceAll("_", " "); return <ContextCard context={context} label={label} selected={selectedContextId === context.id} onClick={() => setSelectedContextId(selectedContextId === context.id ? null : context.id)} key={context.id} />; })}</div>}</section>; }) : <EmptyPanelNote label="context" />}</div></section>{selectedContext ? <ContextDetail context={selectedContext} label={selectedLabel} /> : <section className="panel context-detail-empty"><div className="panel-label"><span>CONTEXT DETAIL</span><span>WAITING</span></div><h2>Pilih context</h2><p className="lead-copy">Klik salah satu context untuk membuka detail dan melihat hubungan langsungnya ke canonical observation/event.</p></section>}</div>}
      {activeMenu === "intelligence" && <div className="menu-grid"><section className="panel intelligence-panel"><div className="panel-label"><span>INTELLIGENCE</span><span>SEMANTIC LAYER</span></div><h2>Intelligence yang terverifikasi</h2><p className="lead-copy">Intelligence akan menjelaskan WHAT, WHY, evidence yang mengonfirmasi atau bertentangan, invalidation, monitoring, dan confidence. Context tidak ditampilkan sebagai intelligence.</p><div className="monitor-list"><div><strong>Context</strong><span>Dipisahkan ke menu Context sebagai canonical grouping layer.</span></div><div><strong>Evidence</strong><span>{evidence.length} evidence canonical tersedia sebagai dasar reasoning.</span></div><div><strong>Inference</strong><span>Belum ada kesimpulan regime, sentiment, liquidity, capital flow, atau price prediction.</span></div></div></section><section className="panel"><div className="panel-label"><span>MONITOR</span><span>STATUS OPERASIONAL</span></div><h2>Apa yang perlu dipantau?</h2><div className="monitor-list"><div><strong>Observasi pasar</strong><span>{observations.length} observasi · kualitas {marketStatus}.</span></div><div><strong>Event makro</strong><span>{highImpactEvents} event berdampak tinggi saat ini.</span></div><div><strong>Kesehatan provider</strong><span>{providerStatus === "FRESH" ? "Semua provider sehat." : "Satu atau lebih provider perlu perhatian."}</span></div><div><strong>Canonical events</strong><span>{events.length} event tersedia untuk context.</span></div></div></section></div>}
      {activeMenu === "evidence" && <div className="menu-grid">{showNews(macroNews, "EVIDENCE BERITA MAKRO")} {showNews(cryptoNews, "EVIDENCE BERITA CRYPTO")}<section className="panel data-health"><div className="panel-label"><span>KESEHATAN DATA</span><span>{providerStatus === "FRESH" ? "SEHAT" : "PERLU PERHATIAN"}</span></div><h2>Status sumber data</h2>{unavailableSources.length ? <><p className="health-warning">Sebagian sumber data tidak tersedia. Ini bukan berarti datanya kosong.</p><div className="source-list">{unavailableSources.map((source) => <span key={source}>{source}</span>)}</div></> : <p className="health-ok">Semua sumber data yang dikonfigurasi mengembalikan data untuk request ini.</p>}</section></div>}
    </div>
    <section className="panel profile"><p className="panel-label">SESI</p><p>Masuk sebagai</p><strong>{sessionEmail}</strong></section>
  </main>;
}

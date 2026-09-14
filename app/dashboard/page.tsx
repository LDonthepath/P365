import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard-data";
import { relativeTimeID } from "@/lib/data/format";
import type { CalendarEvent, NewsItem } from "@/lib/data/types";
import { logout } from "./actions";

function NewsCard({ item }: { item: NewsItem }) {
  return <article className="evidence-item"><div className="card-meta"><span>{item.category}</span><span>{item.source} · {relativeTimeID(item.publishedAt)}</span></div><h3>{item.title}</h3><p>{item.summary}</p><a className="text-link" href={item.url} target="_blank" rel="noreferrer">Inspect source ↗</a></article>;
}
function CalendarRow({ item }: { item: CalendarEvent }) {
  return <article className="calendar-row"><time>{item.time}<small>WIB</small></time><div><h3>{item.event}</h3><p>{item.country} · {item.status}</p></div><span className={`impact ${item.impact.toLowerCase()}`}>{item.impact}</span></article>;
}
function EmptyPanelNote({ label }: { label: string }) { return <p className="muted">Data {label} belum tersedia saat ini. Coba muat ulang beberapa saat lagi.</p>; }
function StatusBadge({ value }: { value: "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" }) { return <span className={`status-badge ${value.toLowerCase()}`}>{value}</span>; }

export default async function DashboardPage() {
  const session = await verifySession((await cookies()).get("market_briefing_session")?.value);
  if (!session) redirect("/login");
  const { macroNews, cryptoNews, calendarEvents, unavailableSources } = await getDashboardData();
  const isLive = unavailableSources.length === 0;
  const totalEvidence = macroNews.length + cryptoNews.length;
  const highImpactEvents = calendarEvents.filter((item) => item.impact === "HIGH").length;

  return <main className="dashboard-shell">
    <header className="topbar"><div><p className="eyebrow">P365 // MARKET INTELLIGENCE</p><h1>Market Intelligence<span>.</span></h1></div><div className="topbar-actions"><p><span className={`live-dot ${isLive ? "" : "warning"}`} /> {isLive ? "DATA HEALTHY" : "DATA PARTIAL"}</p><form action={logout}><button className="logout" type="submit">Keluar</button></form></div></header>
    <nav className="filters" aria-label="Dashboard sections"><button className="active" type="button">Overview</button><button type="button">Macro</button><button type="button">Crypto</button><button type="button">Intelligence</button><button type="button">Evidence</button><span>WIB / ASIA-JAKARTA</span></nav>

    <section className="market-state panel" aria-labelledby="state-title"><div className="panel-label"><span>01 / GLOBAL MARKET STATE</span><StatusBadge value="PENDING" /></div><div className="state-grid"><div><h2 id="state-title">No consolidated market state yet.</h2><p>Validated market observations exist, but the current domain does not yet define enough semantic thresholds to establish a consolidated market interpretation.</p></div><div className="state-meta"><div><span>CONFIDENCE</span><strong>PENDING</strong></div><div><span>EVIDENCE COVERAGE</span><strong>{totalEvidence} items</strong></div><div><span>UPCOMING EVENTS</span><strong>{calendarEvents.length}</strong></div></div></div></section>

    <section className="dashboard-grid"><div className="main-column">
      <section className="panel intelligence-panel" aria-labelledby="intelligence-title"><div className="panel-label"><span>02 / MARKET INTELLIGENCE</span><span>SEMANTIC CONTRACT</span></div><h2 id="intelligence-title">Interpretation is pending.</h2><p className="lead-copy">P365 will only promote an interpretation when evidence is sufficient. This prevents raw headlines, events, or isolated observations from being presented as market intelligence.</p><div className="reasoning-grid"><div><span>WHAT</span><p>No consolidated interpretation.</p></div><div><span>WHY</span><p>Semantic thresholds for higher-level market state are not defined yet.</p></div><div><span>CONFIRMS</span><p>Available evidence can be inspected below.</p></div><div><span>CONTRADICTS</span><p>No validated intelligence claim exists to contradict.</p></div></div><div className="intelligence-footer"><div><span>CONFIDENCE</span><StatusBadge value="PENDING" /></div><div><span>EVIDENCE</span><strong>{totalEvidence}</strong></div></div></section>
      <section className="panel" aria-labelledby="monitor-title"><div className="panel-label"><span>03 / MONITOR</span><span>NO ACTIVE INTERPRETATION</span></div><h2 id="monitor-title">What should be watched?</h2><div className="monitor-list"><div><strong>Market observations</strong><span>Watch freshness and coverage.</span></div><div><strong>Macro events</strong><span>{highImpactEvents} high-impact event(s) currently visible.</span></div><div><strong>Provider health</strong><span>{isLive ? "All current sources report available data." : "One or more sources require attention."}</span></div></div></section>
      <section className="panel" aria-labelledby="evidence-title"><div className="panel-label"><span>04 / RECENT EVIDENCE</span><span>{totalEvidence} ITEMS</span></div><h2 id="evidence-title">Raw evidence layer</h2><p className="section-note">News remains evidence. It is not automatically promoted to intelligence.</p><div className="news-list">{macroNews.slice(0, 4).map((item) => <NewsCard item={item} key={item.id} />)}{cryptoNews.slice(0, 4).map((item) => <NewsCard item={item} key={item.id} />)}{totalEvidence === 0 ? <EmptyPanelNote label="evidence" /> : null}</div></section>
    </div>
    <aside className="side-column">
      <section className="panel market-watch" aria-labelledby="watch-title"><div className="panel-label"><span>05 / MARKET WATCH</span><span>MACRO + CRYPTO</span></div><h2 id="watch-title">Coverage</h2><div className="watch-row"><span>Macro evidence</span><strong>{macroNews.length}</strong><StatusBadge value={macroNews.length ? "FRESH" : "PENDING"} /></div><div className="watch-row"><span>Crypto evidence</span><strong>{cryptoNews.length}</strong><StatusBadge value={cryptoNews.length ? "FRESH" : "PENDING"} /></div><div className="watch-row"><span>Calendar</span><strong>{calendarEvents.length}</strong><StatusBadge value={calendarEvents.length ? "FRESH" : "PENDING"} /></div><div className="watch-row"><span>Providers</span><strong>{unavailableSources.length}</strong><StatusBadge value={isLive ? "FRESH" : "UNAVAILABLE"} /></div></section>
      <section className="panel calendar" aria-labelledby="calendar-title"><div className="panel-label"><span>06 / UPCOMING EVENTS</span><span>TODAY + 3</span></div><h2 id="calendar-title">Agenda penting</h2>{calendarEvents.length > 0 ? calendarEvents.map((item) => <CalendarRow item={item} key={item.id} />) : <EmptyPanelNote label="kalender ekonomi" />}</section>
      <section className="panel data-health" aria-labelledby="health-title"><div className="panel-label"><span>07 / DATA HEALTH</span><span>{isLive ? "HEALTHY" : "ATTENTION"}</span></div><h2 id="health-title">Source status</h2>{unavailableSources.length === 0 ? <p className="health-ok">All configured sources returned available data for this request.</p> : <><p className="health-warning">Some sources are unavailable. This is not equivalent to an empty result.</p><div className="source-list">{unavailableSources.map((source) => <span key={source}>{source}</span>)}</div></>}</section>
      <section className="panel profile"><p className="panel-label">SESSION</p><p>Signed in as</p><strong>{session.email}</strong></section>
    </aside></section>
  </main>;
}

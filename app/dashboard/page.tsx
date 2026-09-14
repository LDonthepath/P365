import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard-data";
import { relativeTimeID } from "@/lib/data/format";
import type { CalendarEvent, NewsItem } from "@/lib/data/types";
import type { DataQuality, ProviderHealth } from "@/lib/domain/types";
import { logout } from "./actions";

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="evidence-item">
      <div className="card-meta">
        <span>{item.category}</span>
        <span>{item.source} · {relativeTimeID(item.publishedAt)}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <a className="text-link" href={item.url} target="_blank" rel="noreferrer">
        Inspect source ↗
      </a>
    </article>
  );
}

function CalendarRow({ item }: { item: CalendarEvent }) {
  return (
    <article className="calendar-row">
      <time>{item.time}<small>WIB</small></time>
      <div><h3>{item.event}</h3><p>{item.country} · {item.status}</p></div>
      <span className={`impact ${item.impact.toLowerCase()}`}>{item.impact}</span>
    </article>
  );
}

function EmptyPanelNote({ label }: { label: string }) {
  return <p className="muted">Data {label} belum tersedia saat ini. Coba muat ulang beberapa saat lagi.</p>;
}

function StatusBadge({ value }: { value: "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" }) {
  return <span className={`status-badge ${value.toLowerCase()}`}>{value}</span>;
}

function observationQualityStatus(qualities: DataQuality[]): "PENDING" | "FRESH" | "PARTIAL" {
  if (qualities.length === 0) return "PENDING";
  if (qualities.every((quality) => quality === "FRESH")) return "FRESH";
  return "PARTIAL";
}

function providerStatus(health: ProviderHealth[]): "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" {
  if (health.length === 0) return "PENDING";
  if (health.some((item) => item.status === "ERROR" || item.status === "UNAVAILABLE")) return "UNAVAILABLE";
  if (health.some((item) => item.status === "STALE")) return "PARTIAL";
  if (health.some((item) => item.status === "EMPTY")) return "PENDING";
  return "FRESH";
}

export default async function DashboardPage() {
  const session = await verifySession((await cookies()).get("market_briefing_session")?.value);
  if (!session) redirect("/login");

  const {
    macroNews,
    cryptoNews,
    calendarEvents,
    unavailableSources,
    observations,
    evidence,
    providerHealth,
  } = await getDashboardData();

  const marketObservationStatus = observationQualityStatus(observations.map((item) => item.quality));
  const sourceStatus = providerStatus(providerHealth);
  const highImpactEvents = calendarEvents.filter((item) => item.impact === "HIGH").length;
  const macroEvidence = evidence.filter((item) => item.kind === "NEWS" && item.sourceId.includes("alpha-vantage"));
  const cryptoEvidence = evidence.filter((item) => item.kind === "NEWS" && !item.sourceId.includes("alpha-vantage"));

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div><p className="eyebrow">P365 // MARKET INTELLIGENCE</p><h1>Market Intelligence<span>.</span></h1></div>
        <div className="topbar-actions">
          <p><span className={`live-dot ${sourceStatus === "UNAVAILABLE" ? "warning" : ""}`} /> {sourceStatus === "FRESH" ? "DATA HEALTHY" : "DATA ATTENTION"}</p>
          <form action={logout}><button className="logout" type="submit">Keluar</button></form>
        </div>
      </header>

      <nav className="filters" aria-label="Dashboard sections">
        <a className="active" href="#overview">Overview</a>
        <a href="#macro-evidence">Macro</a>
        <a href="#crypto-evidence">Crypto</a>
        <a href="#intelligence">Intelligence</a>
        <a href="#evidence">Evidence</a>
        <span>WIB / ASIA-JAKARTA</span>
      </nav>

      <section id="overview" className="market-state panel" aria-labelledby="state-title">
        <div className="panel-label"><span>01 / GLOBAL MARKET STATE</span><StatusBadge value="PENDING" /></div>
        <div className="state-grid">
          <div>
            <h2 id="state-title">No consolidated market state yet.</h2>
            <p>Validated market observations are available, but P365 does not yet have the domain-specific rules required to establish a consolidated market interpretation.</p>
          </div>
          <div className="state-meta">
            <div><span>CONFIDENCE</span><strong>PENDING</strong></div>
            <div><span>OBSERVATIONS</span><strong>{observations.length} · {marketObservationStatus}</strong></div>
            <div><span>CANONICAL EVIDENCE</span><strong>{evidence.length} items</strong></div>
            <div><span>UPCOMING EVENTS</span><strong>{calendarEvents.length}</strong></div>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="main-column">
          <section id="intelligence" className="panel intelligence-panel" aria-labelledby="intelligence-title">
            <div className="panel-label"><span>02 / MARKET INTELLIGENCE</span><span>SEMANTIC CONTRACT</span></div>
            <h2 id="intelligence-title">Interpretation is pending.</h2>
            <p className="lead-copy">P365 will only promote an interpretation when evidence is sufficient. Raw headlines, events, or isolated observations are never presented as market intelligence by themselves.</p>
            <div className="reasoning-grid">
              <div><span>WHAT</span><p>No consolidated interpretation exists yet.</p></div>
              <div><span>WHY</span><p>Higher-level semantic thresholds are not defined yet.</p></div>
              <div><span>CONFIRMS</span><p>Canonical evidence is available for inspection below.</p></div>
              <div><span>CONTRADICTS</span><p>No active intelligence claim exists to contradict.</p></div>
              <div><span>INVALIDATES</span><p>No active interpretation exists, so no invalidation criteria are currently asserted.</p></div>
              <div><span>MONITOR</span><p>Watch observation quality, provider health, and upcoming events.</p></div>
            </div>
            <div className="intelligence-footer">
              <div><span>CONFIDENCE</span><StatusBadge value="PENDING" /></div>
              <div><span>CANONICAL EVIDENCE</span><strong>{evidence.length}</strong></div>
            </div>
          </section>

          <section className="panel" aria-labelledby="monitor-title">
            <div className="panel-label"><span>03 / MONITOR</span><span>NO ACTIVE INTERPRETATION</span></div>
            <h2 id="monitor-title">What should be watched?</h2>
            <div className="monitor-list">
              <div><strong>Market observations</strong><span>{observations.length} canonical observation(s) · {marketObservationStatus} quality.</span></div>
              <div><strong>Macro events</strong><span>{highImpactEvents} high-impact event(s) currently visible.</span></div>
              <div><strong>Provider health</strong><span>{sourceStatus === "FRESH" ? "All configured providers returned healthy results." : "One or more providers require attention."}</span></div>
            </div>
          </section>

          <section id="evidence" className="panel" aria-labelledby="evidence-title">
            <div className="panel-label"><span>04 / RECENT EVIDENCE</span><span>{evidence.length} CANONICAL ITEMS</span></div>
            <h2 id="evidence-title">Raw evidence layer</h2>
            <p className="section-note">Evidence is rendered from the canonical domain layer. News is not automatically promoted to intelligence.</p>
            <div className="news-list">
              {macroNews.slice(0, 4).map((item) => <div id="macro-evidence" key={`macro-${item.id}`}><NewsCard item={item} /></div>)}
              {cryptoNews.slice(0, 4).map((item) => <div id="crypto-evidence" key={`crypto-${item.id}`}><NewsCard item={item} /></div>)}
              {evidence.length === 0 ? <EmptyPanelNote label="evidence" /> : null}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel market-watch" aria-labelledby="watch-title">
            <div className="panel-label"><span>05 / MARKET WATCH</span><span>DOMAIN COVERAGE</span></div>
            <h2 id="watch-title">Coverage</h2>
            <div className="watch-row"><span>Macro evidence</span><strong>{macroEvidence.length}</strong><StatusBadge value={macroEvidence.length ? "FRESH" : "PENDING"} /></div>
            <div className="watch-row"><span>Crypto evidence</span><strong>{cryptoEvidence.length}</strong><StatusBadge value={cryptoEvidence.length ? "FRESH" : "PENDING"} /></div>
            <div className="watch-row"><span>Market observations</span><strong>{observations.length}</strong><StatusBadge value={marketObservationStatus} /></div>
            <div className="watch-row"><span>Providers</span><strong>{providerHealth.length}</strong><StatusBadge value={sourceStatus} /></div>
          </section>

          <section className="panel calendar" aria-labelledby="calendar-title">
            <div className="panel-label"><span>06 / UPCOMING EVENTS</span><span>{calendarEvents.length} ITEMS</span></div>
            <h2 id="calendar-title">Agenda penting</h2>
            {calendarEvents.length > 0 ? calendarEvents.map((item) => <CalendarRow item={item} key={item.id} />) : <EmptyPanelNote label="kalender ekonomi" />}
          </section>

          <section className="panel data-health" aria-labelledby="health-title">
            <div className="panel-label"><span>07 / DATA HEALTH</span><span>{sourceStatus === "FRESH" ? "HEALTHY" : "ATTENTION"}</span></div>
            <h2 id="health-title">Source status</h2>
            {unavailableSources.length === 0
              ? <p className="health-ok">All configured sources returned available data for this request.</p>
              : <><p className="health-warning">Some sources are unavailable. This is not equivalent to an empty result.</p><div className="source-list">{unavailableSources.map((source) => <span key={source}>{source}</span>)}</div></>}
          </section>

          <section className="panel profile"><p className="panel-label">SESSION</p><p>Signed in as</p><strong>{session.email}</strong></section>
        </aside>
      </section>
    </main>
  );
}

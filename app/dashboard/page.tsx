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
      <a className="text-link" href={item.url} target="_blank" rel="noreferrer">Baca sumber ↗</a>
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
  const labelMap: Record<typeof value, string> = {
    PENDING: "BELUM ADA",
    FRESH: "TERBARU",
    PARTIAL: "SEBAGIAN",
    UNAVAILABLE: "TIDAK TERSEDIA",
  };
  return <span className={`status-badge ${value.toLowerCase()}`}>{labelMap[value]}</span>;
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

const filterLinkStyle = { color: "var(--muted)", textDecoration: "none", padding: "9px 11px", fontSize: "11px" } as const;
const activeFilterLinkStyle = { ...filterLinkStyle, color: "var(--bg)", background: "var(--lime)", borderRadius: "3px" } as const;

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
  const macroNewsEvidenceCount = macroNews.length;
  const cryptoNewsEvidenceCount = cryptoNews.length;

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div><p className="eyebrow">P365 // MARKET INTELLIGENCE</p><h1>Market Intelligence<span>.</span></h1></div>
        <div className="topbar-actions">
          <p><span className={`live-dot ${sourceStatus === "UNAVAILABLE" ? "warning" : ""}`} /> {sourceStatus === "FRESH" ? "DATA SEHAT" : "PERLU PERHATIAN"}</p>
          <form action={logout}><button className="logout" type="submit">Keluar</button></form>
        </div>
      </header>

      <nav className="filters" aria-label="Bagian dashboard">
        <a href="#overview" style={activeFilterLinkStyle}>Overview</a>
        <a href="#macro-evidence" style={filterLinkStyle}>Macro</a>
        <a href="#crypto-evidence" style={filterLinkStyle}>Crypto</a>
        <a href="#intelligence" style={filterLinkStyle}>Intelligence</a>
        <a href="#evidence" style={filterLinkStyle}>Evidence</a>
        <span>WIB / ASIA-JAKARTA</span>
      </nav>

      <section id="overview" className="market-state panel" aria-labelledby="state-title">
        <div className="panel-label"><span>01 / STATUS PASAR GLOBAL</span><StatusBadge value="PENDING" /></div>
        <div className="state-grid">
          <div>
            <h2 id="state-title">Belum ada kesimpulan status pasar.</h2>
            <p>Observasi pasar yang tervalidasi sudah tersedia, tapi P365 belum punya aturan domain-specific untuk menyusunnya jadi satu interpretasi status pasar yang solid.</p>
          </div>
          <div className="state-meta">
            <div><span>CONFIDENCE</span><strong>BELUM ADA</strong></div>
            <div><span>OBSERVASI</span><strong>{observations.length} · {marketObservationStatus}</strong></div>
            <div><span>EVIDENCE KANONIK</span><strong>{evidence.length} item</strong></div>
            <div><span>EVENT MENDATANG</span><strong>{calendarEvents.length}</strong></div>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="main-column">
          <section id="intelligence" className="panel intelligence-panel" aria-labelledby="intelligence-title">
            <div className="panel-label"><span>02 / MARKET INTELLIGENCE</span><span>SEMANTIC CONTRACT</span></div>
            <h2 id="intelligence-title">Interpretasi belum tersedia.</h2>
            <p className="lead-copy">P365 hanya akan menampilkan sebuah interpretasi kalau evidence-nya cukup kuat. Headline mentah, event, atau observasi yang berdiri sendiri tidak pernah disajikan sebagai market intelligence.</p>
            <div className="reasoning-grid">
              <div><span>WHAT</span><p>Belum ada interpretasi yang tersusun.</p></div>
              <div><span>WHY</span><p>Ambang batas semantik tingkat lanjut belum didefinisikan.</p></div>
              <div><span>CONFIRMS</span><p>Evidence kanonik bisa dilihat di bagian bawah.</p></div>
              <div><span>CONTRADICTS</span><p>Belum ada klaim intelligence aktif untuk dibantah.</p></div>
              <div><span>INVALIDATES</span><p>Belum ada interpretasi aktif, jadi belum ada kriteria pembatalan.</p></div>
              <div><span>MONITOR</span><p>Pantau kualitas observasi, kesehatan provider, dan event mendatang.</p></div>
            </div>
            <div className="intelligence-footer">
              <div><span>CONFIDENCE</span><StatusBadge value="PENDING" /></div>
              <div><span>EVIDENCE KANONIK</span><strong>{evidence.length}</strong></div>
            </div>
          </section>

          <section className="panel" aria-labelledby="monitor-title">
            <div className="panel-label"><span>03 / MONITOR</span><span>BELUM ADA INTERPRETASI AKTIF</span></div>
            <h2 id="monitor-title">Apa yang perlu dipantau?</h2>
            <div className="monitor-list">
              <div><strong>Observasi pasar</strong><span>{observations.length} observasi kanonik · kualitas {marketObservationStatus}.</span></div>
              <div><strong>Event makro</strong><span>{highImpactEvents} event berdampak tinggi saat ini.</span></div>
              <div><strong>Kesehatan provider</strong><span>{sourceStatus === "FRESH" ? "Semua provider yang dikonfigurasi mengembalikan hasil sehat." : "Satu atau lebih provider perlu perhatian."}</span></div>
            </div>
          </section>

          <section id="evidence" className="panel" aria-labelledby="evidence-title">
            <div className="panel-label"><span>04 / EVIDENCE TERBARU</span><span>{evidence.length} ITEM KANONIK</span></div>
            <h2 id="evidence-title">Lapisan evidence mentah</h2>
            <p className="section-note">Evidence dirender dari domain layer kanonik. Berita tidak otomatis dinaikkan jadi intelligence.</p>
            <div className="news-list">
              <div id="macro-evidence"><span className="eyebrow">EVIDENCE BERITA MAKRO · {macroNewsEvidenceCount}</span>{macroNews.slice(0, 4).map((item) => <NewsCard item={item} key={`macro-${item.id}`} />)}</div>
              <div id="crypto-evidence"><span className="eyebrow">EVIDENCE BERITA CRYPTO · {cryptoNewsEvidenceCount}</span>{cryptoNews.slice(0, 4).map((item) => <NewsCard item={item} key={`crypto-${item.id}`} />)}</div>
              {evidence.length === 0 ? <EmptyPanelNote label="evidence" /> : null}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel market-watch" aria-labelledby="watch-title">
            <div className="panel-label"><span>05 / MARKET WATCH</span><span>CAKUPAN DOMAIN</span></div>
            <h2 id="watch-title">Cakupan</h2>
            <div className="watch-row"><span>Evidence berita makro</span><strong>{macroNewsEvidenceCount}</strong><StatusBadge value={macroNewsEvidenceCount ? "FRESH" : "PENDING"} /></div>
            <div className="watch-row"><span>Evidence berita crypto</span><strong>{cryptoNewsEvidenceCount}</strong><StatusBadge value={cryptoNewsEvidenceCount ? "FRESH" : "PENDING"} /></div>
            <div className="watch-row"><span>Observasi pasar</span><strong>{observations.length}</strong><StatusBadge value={marketObservationStatus} /></div>
            <div className="watch-row"><span>Provider</span><strong>{providerHealth.length}</strong><StatusBadge value={sourceStatus} /></div>
          </section>

          <section className="panel calendar" aria-labelledby="calendar-title">
            <div className="panel-label"><span>06 / EVENT MENDATANG</span><span>{calendarEvents.length} ITEM</span></div>
            <h2 id="calendar-title">Agenda penting</h2>
            {calendarEvents.length > 0 ? calendarEvents.map((item) => <CalendarRow item={item} key={item.id} />) : <EmptyPanelNote label="kalender ekonomi" />}
          </section>

          <section className="panel data-health" aria-labelledby="health-title">
            <div className="panel-label"><span>07 / KESEHATAN DATA</span><span>{sourceStatus === "FRESH" ? "SEHAT" : "PERLU PERHATIAN"}</span></div>
            <h2 id="health-title">Status sumber data</h2>
            {unavailableSources.length === 0
              ? <p className="health-ok">Semua sumber data yang dikonfigurasi mengembalikan data untuk request ini.</p>
              : <><p className="health-warning">Sebagian sumber data tidak tersedia. Ini bukan berarti datanya kosong.</p><div className="source-list">{unavailableSources.map((source) => <span key={source}>{source}</span>)}</div></>}
          </section>

          <section className="panel profile"><p className="panel-label">SESI</p><p>Masuk sebagai</p><strong>{session.email}</strong></section>
        </aside>
      </section>
    </main>
  );
}

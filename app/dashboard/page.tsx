import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard-data";
import { relativeTimeID } from "@/lib/data/format";
import type { CalendarEvent, NewsItem } from "@/lib/data/types";
import { logout } from "./actions";

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="news-card">
      <div className="card-meta">
        <span>{item.category}</span>
        <span>{item.source} · {relativeTimeID(item.publishedAt)}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <a className="text-link" href={item.url} target="_blank" rel="noreferrer">
        Baca sumber ↗
      </a>
    </article>
  );
}

function CalendarRow({ item }: { item: CalendarEvent }) {
  return (
    <article className="calendar-row">
      <time>
        {item.time}
        <small>WIB</small>
      </time>
      <div>
        <h3>{item.event}</h3>
        <p>{item.country} · {item.status}</p>
      </div>
      <span className={`impact ${item.impact.toLowerCase()}`}>{item.impact}</span>
    </article>
  );
}

function EmptyPanelNote({ label }: { label: string }) {
  return <p className="muted">Data {label} belum tersedia saat ini. Coba muat ulang beberapa saat lagi.</p>;
}

export default async function DashboardPage() {
  const session = await verifySession((await cookies()).get("market_briefing_session")?.value);
  if (!session) redirect("/login");

  const { macroNews, cryptoNews, calendarEvents, unavailableSources } = await getDashboardData();
  const highImpactEvent = calendarEvents.find((item) => item.impact === "HIGH");
  const topCryptoHeadline = cryptoNews[0];
  const isLive = unavailableSources.length === 0;

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">MARKET INTELLIGENCE // PRIVATE</p>
          <h1>Market Briefing<span>.</span></h1>
        </div>
        <div className="topbar-actions">
          <p><span className="live-dot" /> {isLive ? "DATA LIVE" : "SEBAGIAN DATA TIDAK TERSEDIA"}</p>
          <form action={logout}><button className="logout" type="submit">Keluar</button></form>
        </div>
      </header>

      <nav className="filters" aria-label="Dashboard sections">
        <button className="active" type="button">Overview</button>
        <button type="button">Macro</button>
        <button type="button">Crypto</button>
        <button type="button">Calendar</button>
        <span>WIB / ASIA-JAKARTA</span>
      </nav>

      <section className="briefing panel" aria-labelledby="briefing-title">
        <div className="panel-label">
          <span>01 / DAILY BRIEFING</span>
          <time>LIVE</time>
        </div>
        <h2 id="briefing-title">Market focus before the session begins.</h2>
        <p>
          Ringkasan otomatis berbasis data real dari Alpha Vantage, CoinDesk, dan Financial Modeling Prep.
          Ringkasan naratif AI penuh berbahasa Indonesia menyusul di sprint berikutnya.
        </p>
        <div className="briefing-points">
          <span>• Event ekonomi mendatang: {calendarEvents.length}</span>
          <span>• Berita makro terpantau: {macroNews.length}</span>
          <span>• Berita crypto terpantau: {cryptoNews.length}</span>
        </div>
        {unavailableSources.length > 0 && (
          <p className="muted">Sumber belum tersedia: {unavailableSources.join(", ")}.</p>
        )}
      </section>

      <section className="dashboard-grid">
        <div className="main-column">
          <section className="panel" aria-labelledby="priority-title">
            <div className="panel-label">
              <span>02 / PRIORITY SIGNALS</span>
              <span>{[highImpactEvent, topCryptoHeadline].filter(Boolean).length} ITEMS</span>
            </div>
            <h2 id="priority-title">Perlu diperhatikan</h2>
            <div className="priority-list">
              {highImpactEvent ? (
                <article>
                  <div><span className="impact high">HIGH</span><span className="tag">MACRO</span></div>
                  <h3>{highImpactEvent.event}</h3>
                  <p>{highImpactEvent.time} WIB · Event berdampak tinggi</p>
                </article>
              ) : null}
              {topCryptoHeadline ? (
                <article>
                  <div><span className="impact high">HIGH</span><span className="tag">CRYPTO</span></div>
                  <h3>{topCryptoHeadline.title}</h3>
                  <p>{topCryptoHeadline.source} · {relativeTimeID(topCryptoHeadline.publishedAt)}</p>
                </article>
              ) : null}
              {!highImpactEvent && !topCryptoHeadline ? (
                <EmptyPanelNote label="priority signal" />
              ) : null}
            </div>
          </section>

          <section className="panel news-section" aria-labelledby="macro-title">
            <div className="panel-label">
              <span>03 / MACRO NEWS</span>
              <span>ALPHA VANTAGE</span>
            </div>
            <h2 id="macro-title">Konteks makro</h2>
            <div className="news-list">
              {macroNews.length > 0
                ? macroNews.map((item) => <NewsCard item={item} key={item.id} />)
                : <EmptyPanelNote label="berita makro" />}
            </div>
          </section>

          <section className="panel news-section" aria-labelledby="crypto-title">
            <div className="panel-label">
              <span>04 / CRYPTO NEWS</span>
              <span>COINDESK + ALPHA VANTAGE</span>
            </div>
            <h2 id="crypto-title">Konteks crypto</h2>
            <div className="news-list">
              {cryptoNews.length > 0
                ? cryptoNews.map((item) => <NewsCard item={item} key={item.id} />)
                : <EmptyPanelNote label="berita crypto" />}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel calendar" aria-labelledby="calendar-title">
            <div className="panel-label">
              <span>05 / ECONOMIC CALENDAR</span>
              <span>TODAY + 3</span>
            </div>
            <h2 id="calendar-title">Agenda penting</h2>
            {calendarEvents.length > 0
              ? calendarEvents.map((item) => <CalendarRow item={item} key={item.id} />)
              : <EmptyPanelNote label="kalender ekonomi" />}
          </section>

          <section className="panel profile">
            <p className="panel-label">SESSION</p>
            <p>Signed in as</p>
            <strong>{session.email}</strong>
            <p className="muted">
              {isLive
                ? "Semua sumber data aktif."
                : "Beberapa sumber data sedang tidak tersedia — cek environment variable API key terkait."}
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

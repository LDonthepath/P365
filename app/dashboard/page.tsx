import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { logout } from "./actions";

const calendarEvents = [
  { time: "19:30", event: "US Consumer Price Index", country: "US", impact: "HIGH", status: "UPCOMING" },
  { time: "21:00", event: "Consumer Sentiment", country: "US", impact: "MEDIUM", status: "UPCOMING" },
  { time: "01:00", event: "FOMC Member Speech", country: "US", impact: "HIGH", status: "TOMORROW" },
];
const macroNews = [
  { category: "CENTRAL BANK", source: "Reuters", age: "32m ago", title: "Markets assess the policy outlook ahead of key inflation data", summary: "Pasar menantikan data inflasi untuk membaca arah ekspektasi kebijakan moneter berikutnya." },
  { category: "MACRO", source: "Financial Times", age: "1h ago", title: "Global risk appetite remains sensitive to economic data", summary: "Pelaku pasar masih menempatkan data ekonomi utama sebagai penentu sentimen aset berisiko." },
];
const cryptoNews = [
  { category: "REGULATION", source: "The Block", age: "45m ago", title: "Digital asset policy developments remain in focus", summary: "Perkembangan kebijakan aset digital menjadi tema yang perlu dipantau karena dapat memengaruhi akses dan sentimen pasar." },
  { category: "MARKET STRUCTURE", source: "CoinDesk", age: "2h ago", title: "Crypto market participants prepare for a busy macro week", summary: "Pelaku pasar crypto memperhatikan agenda makro sebagai faktor yang berpotensi meningkatkan volatilitas." },
];
function NewsCard({ item }: { item: (typeof macroNews)[number] }) {
  return <article className="news-card"><div className="card-meta"><span>{item.category}</span><span>{item.source} · {item.age}</span></div><h3>{item.title}</h3><p><b>Ringkasan ID:</b> {item.summary}</p><button className="text-link" type="button">Sumber akan tersedia ↗</button></article>;
}
export default async function DashboardPage() {
  const session = await verifySession((await cookies()).get("market_briefing_session")?.value);
  if (!session) redirect("/login");
  return <main className="dashboard-shell">
    <header className="topbar"><div><p className="eyebrow">MARKET INTELLIGENCE // PRIVATE</p><h1>Market Briefing<span>.</span></h1></div><div className="topbar-actions"><p><span className="live-dot" /> DATA MOCK · Sprint 1</p><form action={logout}><button className="logout" type="submit">Keluar</button></form></div></header>
    <nav className="filters" aria-label="Dashboard sections"><button className="active" type="button">Overview</button><button type="button">Macro</button><button type="button">Crypto</button><button type="button">Calendar</button><span>WIB / ASIA-JAKARTA</span></nav>
    <section className="briefing panel" aria-labelledby="briefing-title"><div className="panel-label"><span>01 / DAILY BRIEFING</span><time>PREVIEW · 08:00 WIB</time></div><h2 id="briefing-title">Market focus before the session begins.</h2><p>Ini adalah kerangka briefing harian. Pada sprint berikutnya, panel ini akan merangkum berita makro, perkembangan crypto, dan agenda ekonomi aktual dalam Bahasa Indonesia.</p><div className="briefing-points"><span>• Fokus: inflasi & kebijakan moneter</span><span>• Risiko: event berdampak tinggi</span><span>• Crypto: regulasi & market structure</span></div></section>
    <section className="dashboard-grid"><div className="main-column"><section className="panel" aria-labelledby="priority-title"><div className="panel-label"><span>02 / PRIORITY SIGNALS</span><span>2 ITEMS</span></div><h2 id="priority-title">Perlu diperhatikan</h2><div className="priority-list"><article><div><span className="impact high">HIGH</span><span className="tag">MACRO</span></div><h3>US Consumer Price Index</h3><p>19:30 WIB · Event berdampak tinggi</p></article><article><div><span className="impact high">HIGH</span><span className="tag">CRYPTO</span></div><h3>Digital asset policy update</h3><p>Artikel prioritas · Data contoh</p></article></div></section><section className="panel news-section" aria-labelledby="macro-title"><div className="panel-label"><span>03 / MACRO NEWS</span><span>MOCK DATA</span></div><h2 id="macro-title">Konteks makro</h2><div className="news-list">{macroNews.map((item) => <NewsCard item={item} key={item.title} />)}</div></section><section className="panel news-section" aria-labelledby="crypto-title"><div className="panel-label"><span>04 / CRYPTO NEWS</span><span>MOCK DATA</span></div><h2 id="crypto-title">Konteks crypto</h2><div className="news-list">{cryptoNews.map((item) => <NewsCard item={item} key={item.title} />)}</div></section></div>
      <aside className="side-column"><section className="panel calendar" aria-labelledby="calendar-title"><div className="panel-label"><span>05 / ECONOMIC CALENDAR</span><span>TODAY + 1</span></div><h2 id="calendar-title">Agenda penting</h2>{calendarEvents.map((item) => <article className="calendar-row" key={item.event}><time>{item.time}<small>WIB</small></time><div><h3>{item.event}</h3><p>{item.country} · {item.status}</p></div><span className={`impact ${item.impact.toLowerCase()}`}>{item.impact}</span></article>)}</section><section className="panel profile"><p className="panel-label">SESSION</p><p>Signed in as</p><strong>{session.email}</strong><p className="muted">Data di halaman ini adalah mock untuk review Sprint 1.</p></section></aside></section>
  </main>;
}

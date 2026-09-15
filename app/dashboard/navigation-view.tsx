"use client";

import { useState } from "react";

type Menu = "dashboard" | "market-data" | "events" | "expectation" | "news" | "intelligence";

const menuItems: { id: Menu; label: string; description: string }[] = [
  { id: "dashboard", label: "Dashboard", description: "Market briefing overview" },
  { id: "market-data", label: "Market Data", description: "Structured market observations" },
  { id: "events", label: "Events", description: "Economic and market events" },
  { id: "expectation", label: "Expectation", description: "Consensus and forecasts" },
  { id: "news", label: "News & Evidence", description: "News and source evidence" },
  { id: "intelligence", label: "Intelligence", description: "Reasoning and market explanation" },
];

const marketDomains = ["Macro", "Crypto", "Equity", "Fixed Income", "FX", "Commodities", "Volatility"];

export function NavigationView({ sessionEmail }: { sessionEmail: string }) {
  const [activeMenu, setActiveMenu] = useState<Menu>("dashboard");

  const activeItem = menuItems.find((item) => item.id === activeMenu) ?? menuItems[0];

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">P</span>
            <p className="eyebrow">P365 // MARKET INTELLIGENCE</p>
          </div>
          <h1>Market Intelligence<span>.</span></h1>
        </div>
        <div className="topbar-actions">
          <p><span className="live-dot" /> UI FOUNDATION</p>
          <p className="muted">{sessionEmail}</p>
        </div>
      </header>

      <nav className="filters" aria-label="P365 navigation" role="tablist">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeMenu === item.id}
            className={activeMenu === item.id ? "active" : ""}
            onClick={() => setActiveMenu(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span>WIB / ASIA-JAKARTA</span>
      </nav>

      <div className="dashboard-content" role="tabpanel">
        <section className="panel market-state" aria-labelledby="navigation-title">
          <div className="panel-label">
            <span>PLACEHOLDER / {activeItem.label.toUpperCase()}</span>
            <span>UI ONLY</span>
          </div>
          <h2 id="navigation-title">{activeItem.label}</h2>
          <p className="lead-copy">{activeItem.description}. Section ini masih berupa placeholder. Belum ada data, engine, atau intelligence logic yang diubah.</p>
        </section>

        {activeMenu === "market-data" && (
          <section className="panel" style={{ marginTop: "1.25rem" }} aria-labelledby="market-domains-title">
            <div className="panel-label"><span>MARKET DATA MATRIX</span><span>PLACEHOLDER</span></div>
            <h2 id="market-domains-title">Market domains</h2>
            <p className="lead-copy">Struktur domain awal. Data provider akan dipetakan ke domain ini secara bertahap.</p>
            <div className="context-groups">
              {marketDomains.map((domain) => (
                <div className="context-group" key={domain}>
                  <div className="context-group-button">
                    <span><small>MARKET DATA</small><strong>{domain}</strong></span>
                    <span>COMING SOON →</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeMenu === "news" && (
          <section className="panel" style={{ marginTop: "1.25rem" }}>
            <div className="panel-label"><span>NEWS / EVIDENCE</span><span>SEPARATED</span></div>
            <h2>News & Evidence</h2>
            <p className="lead-copy">News akan menjadi jalur terpisah dari market data. Provider berita dan evidence akan masuk di layer ini.</p>
          </section>
        )}
      </div>

      <section className="panel profile">
        <p className="panel-label">SESSION</p>
        <p>Masuk sebagai</p>
        <strong>{sessionEmail}</strong>
      </section>
    </main>
  );
}

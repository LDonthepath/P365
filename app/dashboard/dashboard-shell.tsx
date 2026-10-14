"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/data/dashboard-data";
import { relativeTimeID } from "@/lib/data/format";
import { buildBaselinePresentations } from "@/lib/presentation/baseline";
import { logout, refreshDashboardData } from "./actions";
import { OverviewSection } from "./dashboard-overview-feature";
import { MarketSection } from "./dashboard-market-feature";
import { MacroSection } from "./dashboard-macro-feature";
import { CryptoSection } from "./dashboard-crypto-feature";
import { GoldSection } from "./dashboard-gold-feature";
import { ContextSection } from "./dashboard-context-feature";
import { EvidenceSection } from "./dashboard-evidence-feature";

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


export function DashboardShell({ data, sessionEmail }: { data: DashboardData; sessionEmail: string }) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<Menu>("overview");
  const [isRefreshing, startRefresh] = useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedMacroTheme, setExpandedMacroTheme] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { macroBaselines } = data;
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

  return <main className="dashboard-shell">
    <button className="nav-toggle" type="button" aria-label={navOpen ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={navOpen} aria-controls="dashboard-navigation" onClick={() => setNavOpen((open) => !open)}><span /><span /><span /></button>
    <header className="topbar"><div className="topbar-brand-group"><div className="brand-lockup"><img className="brand-logo" src="/project365-logo.svg" alt="PROJECT365" /><p className="eyebrow">PROJECT365</p></div></div><div className="topbar-actions">{lastRefreshedAt && <p className="muted refresh-note">Refresh manual terakhir: {relativeTimeID(lastRefreshedAt)}</p>}<button className="refresh-btn" type="button" onClick={handleManualRefresh} disabled={isRefreshing} aria-busy={isRefreshing}>{isRefreshing ? "Memuat ulang…" : "Muat ulang manual"}</button><div className="account-menu"><button className={`account-menu-trigger${accountOpen ? " active" : ""}`} type="button" aria-label="Buka menu akun" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.7-3.5 3-5.3 6.5-5.3s5.8 1.8 6.5 5.3" /></svg></button>{accountOpen && <div className="account-popover" role="menu"><div className="account-popover-identity"><span>AKUN</span><strong>{sessionEmail}</strong></div><form action={logout}><button className="account-signout" type="submit">Keluar</button></form></div>}</div></div></header>
    {navOpen && <button className="nav-backdrop" type="button" aria-label="Tutup navigasi" onClick={() => setNavOpen(false)} />}
    <nav id="dashboard-navigation" className={`filters${navOpen ? " open" : ""}`} aria-label="Bagian dashboard" role="tablist">{menuItems.map((item) => <button key={item.id} type="button" role="tab" aria-selected={activeMenu === item.id} className={activeMenu === item.id ? "active" : ""} onClick={() => { setActiveMenu(item.id); setNavOpen(false); }}>{item.label}</button>)}<span>WIB / ASIA-JAKARTA</span></nav>

    <div className="dashboard-content" role="tabpanel">
      {activeMenu === "overview" && <OverviewSection data={data} />}
      {activeMenu === "heatmap" && <MarketSection data={data} baselinePresentations={baselinePresentations} />}
      {activeMenu === "macro" && <MacroSection data={data} baselinesBySeries={baselinesBySeries} expandedMacroTheme={expandedMacroTheme} onToggleMacroTheme={(id) => setExpandedMacroTheme(expandedMacroTheme === id ? null : id)} />}
      {activeMenu === "crypto" && <CryptoSection data={data} />}
      {activeMenu === "gold" && <GoldSection data={data} />}
      {activeMenu === "context" && <ContextSection data={data} selectedContextId={selectedContextId} expandedGroup={expandedGroup} onSelectContext={(id) => setSelectedContextId(selectedContextId === id ? null : id)} onToggleGroup={(id) => setExpandedGroup(expandedGroup === id ? null : id)} />}
      {activeMenu === "evidence" && <EvidenceSection data={data} />}
    </div>
  </main>;
}


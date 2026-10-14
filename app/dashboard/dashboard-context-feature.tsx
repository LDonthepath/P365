"use client";

import type { DashboardData } from "@/lib/data/dashboard-data";
import type { Context } from "@/lib/domain/types";
import type { NewsItem } from "@/lib/data/types";
import { relativeTimeID } from "@/lib/data/format";
import { MACRO_CONTEXT_LABELS } from "./dashboard-macro-feature";
import { EmptyPanelNote } from "./dashboard-common-ui";
import { CatalystWirePanel } from "./catalyst-wire-panel";
import { EventRiskWindowPanel } from "./event-risk-window-panel";
import { MvpFactualContextPanel } from "./mvp-factual-context-panel";
import { IntradayEventResponsePanel } from "./intraday-event-response-panel";

type ContextGroup = { id: string; label: string; contexts: Context[] };

function NewsCard({ item }: { item: NewsItem }) {
  return <article className="evidence-item"><div className="card-meta"><span>{item.category}</span><span>{item.source} · {relativeTimeID(item.publishedAt)}</span></div><h3>{item.title}</h3><p>{item.summary}</p><a className="text-link" href={item.url} target="_blank" rel="noreferrer">Baca sumber ↗</a></article>;
}


function ContextCard({ context, label, selected, onClick }: { context: Context; label: string; selected: boolean; onClick: () => void }) {
  return <button type="button" className={`context-card context-card-button${selected ? " selected" : ""}`} aria-pressed={selected} onClick={onClick}><div className="context-card-head"><span className="context-scope">{label}</span><span className="context-count">{context.observationIds.length} OBS · {context.eventIds.length} EVENT</span></div><h3>{context.statement}</h3><p>Terkait langsung ke data dan event yang membentuk konteks ini. Klik untuk melihat rinciannya.</p></button>;
}

function ContextDetail({ context, label }: { context: Context; label: string }) {
  return <section className="panel context-detail"><div className="panel-label"><span>RINCIAN KONTEKS</span><span>{label}</span></div><h2>{context.statement}</h2><p className="lead-copy">Konteks hanya mengelompokkan data yang sudah tersedia. Bagian ini tidak memberi sinyal arah pasar.</p><div className="monitor-list"><div><strong>SCOPE</strong><span>{context.scope}</span></div><div><strong>OBSERVATIONS</strong><span>{context.observationIds.length ? context.observationIds.join(" · ") : "Tidak ada"}</span></div><div><strong>EVENTS</strong><span>{context.eventIds.length ? context.eventIds.join(" · ") : "Tidak ada"}</span></div><div><strong>CREATED</strong><span>{relativeTimeID(context.createdAt)}</span></div></div></section>;
}


export function ContextSection({ data, selectedContextId, expandedGroup, onSelectContext, onToggleGroup }: { data: DashboardData; selectedContextId: string | null; expandedGroup: string | null; onSelectContext: (id: string) => void; onToggleGroup: (id: string) => void }) {
  const { macroNews, cryptoNews, events, contexts } = data;
  const cryptoContexts = contexts.filter((context) => context.scope === "CRYPTO_MARKET");
  const macroContexts = contexts.filter((context) => context.scope.startsWith("MACRO_"));
  const economicEventContexts = contexts.filter((context) => context.scope === "ECONOMIC_EVENTS");
  const contextGroups: ContextGroup[] = [{ id: "crypto", label: "CRYPTO MARKET", contexts: cryptoContexts }, { id: "macro", label: "MACRO", contexts: macroContexts }, { id: "events", label: "ECONOMIC EVENTS", contexts: economicEventContexts }].filter((group) => group.contexts.length > 0);
  const selectedContext = contexts.find((context) => context.id === selectedContextId) ?? null;
  const selectedLabel = selectedContext ? selectedContext.scope === "CRYPTO_MARKET" ? selectedContext.id.replace("context-crypto-", "").toUpperCase() : selectedContext.scope === "ECONOMIC_EVENTS" ? "Scheduled Events" : MACRO_CONTEXT_LABELS[selectedContext.scope] ?? selectedContext.scope.replaceAll("MACRO_", "").replaceAll("_", " ") : "";
  const showNews = (items: NewsItem[], label: string) => {
    const visible = items.slice(0, 6);
    const overflow = items.slice(6);
    return <section className="panel news-panel">
      <div className="panel-label"><span>{label}</span><span>{items.length} ITEM</span></div>
      <h2>Evidence berita terbaru</h2>
      <div className="news-list">{visible.length ? visible.map((item) => <NewsCard item={item} key={item.id} />) : <EmptyPanelNote label={label.toLowerCase()} />}</div>
      {overflow.length > 0
        ? <details className="news-more">
            <summary><span>{overflow.length} berita lainnya</span><strong>LIHAT SEMUA</strong></summary>
            <div className="news-list">{overflow.map((item) => <NewsCard item={item} key={item.id} />)}</div>
          </details>
        : null}
    </section>;
  };

  return <>
        <div className="page-intro">
          <span>KONTEKS</span>
          <h1>Catalyst dan investigasi bukti</h1>
          <p>Bagian Konteks menampung catalyst, kalender event, berita, konteks faktual lintas Makro → BTC + Gold, dan respons pasar setelah event. Kedekatan waktu tidak dipromosikan menjadi sebab-akibat.</p>
        </div>
        <CatalystWirePanel data={data.catalystWire} />
        <div style={{ marginTop: "1rem" }}>
          <EventRiskWindowPanel events={[...events, ...data.durableHighImpactEvents]} asOf={data.mvpFactualContext.asOf} forwardCoverage={data.calendarForwardCoverage} />
        </div>
        <div className="menu-grid" style={{ marginTop: "1rem" }}>
          {showNews(macroNews, "BERITA MAKRO")}
          {showNews(cryptoNews, "BERITA CRYPTO")}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <MvpFactualContextPanel data={data.mvpFactualContext} />
        </div>
        <div className="menu-grid context-menu" style={{ marginTop: "1rem" }}>
          <section className="panel intelligence-panel">
            <div className="panel-label"><span>MARKET CONTEXT</span><span>{contexts.length} CONTEXT</span></div>
            <h2>Konteks pasar</h2>
            <p className="lead-copy">Bagian ini mengelompokkan data dan event yang saling terkait. Gunakan jika ingin menelusuri detail di balik briefing.</p>
            <div className="context-groups">
              {contextGroups.length
                ? contextGroups.map((group) => {
                    const isExpanded = expandedGroup === group.id;
                    return <section className={`context-group${isExpanded ? " expanded" : ""}`} key={group.id}>
                      <button type="button" className="context-group-button" aria-expanded={isExpanded} onClick={() => onToggleGroup(group.id)}>
                        <span><small>CONTEXT GROUP</small><strong>{group.label}</strong></span>
                        <span>{group.contexts.length} CONTEXT {isExpanded ? "↑" : "→"}</span>
                      </button>
                      {isExpanded && <div className="context-list">
                        {group.contexts.map((context) => {
                          const label = context.scope === "CRYPTO_MARKET"
                            ? context.id.replace("context-crypto-", "").toUpperCase()
                            : context.scope === "ECONOMIC_EVENTS"
                              ? "Scheduled Events"
                              : MACRO_CONTEXT_LABELS[context.scope] ?? context.scope.replaceAll("MACRO_", "").replaceAll("_", " ");
                          return <ContextCard context={context} label={label} selected={selectedContextId === context.id} onClick={() => onSelectContext(context.id)} key={context.id} />;
                        })}
                      </div>}
                    </section>;
                  })
                : <EmptyPanelNote label="context" />}
            </div>
          </section>
          {selectedContext
            ? <ContextDetail context={selectedContext} label={selectedLabel} />
            : <section className="panel context-detail-empty">
                <div className="panel-label"><span>RINCIAN KONTEKS</span><span>PILIH KONTEKS</span></div>
                <h2>Pilih konteks</h2>
                <p className="lead-copy">Klik salah satu konteks untuk melihat data dan event yang terkait.</p>
              </section>}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <IntradayEventResponsePanel result={data.intradayEventMonitor} />
        </div>
      </>;
}

"use client";

import type { DashboardData } from "@/lib/data/dashboard-data";
import type { Evidence } from "@/lib/domain/types";
import { relativeTimeID } from "@/lib/data/format";
import { EmptyPanelNote } from "./dashboard-common-ui";



export function EvidenceSection({ data }: { data: DashboardData }) {
  const { evidence } = data;
  return <div className="menu-grid"><section className="panel intelligence-panel evidence-browser"><div className="panel-label"><span>EVIDENCE</span><span>{evidence.length} ITEM</span></div><h2>Jejak sumber data</h2><p className="lead-copy">Daftar sumber data yang dipakai P365. Bagian ini untuk audit dan penelusuran, bukan tampilan utama untuk mengambil keputusan.</p>{evidence.length ? <><div className="monitor-list evidence-list">{evidence.slice(0, 12).map((item: Evidence) => <div key={item.id}><strong>{item.kind}</strong><span>{item.subject} · {item.sourceId} · {relativeTimeID(item.capturedAt)}</span></div>)}</div>{evidence.slice(12, 24).length > 0 ? <details className="evidence-more"><summary><span>{Math.min(12, evidence.length - 12)} evidence lainnya</span><strong>LIHAT LANJUTAN</strong></summary><div className="monitor-list evidence-list">{evidence.slice(12, 24).map((item: Evidence) => <div key={item.id}><strong>{item.kind}</strong><span>{item.subject} · {item.sourceId} · {relativeTimeID(item.capturedAt)}</span></div>)}</div></details> : null}</> : <EmptyPanelNote label="evidence" />}</section></div>;
}

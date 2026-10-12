"use client";

import { useEffect, useState } from "react";
import type { Event } from "@/lib/domain/types";
import type { CalendarForwardCoverage, CoverageStatus } from "@/lib/application/calendar-forward-coverage";
import { ECONOMIC_CALENDAR_LIMIT } from "@/lib/data/types";
import {
  EVENT_RISK_WINDOW_HOURS,
  buildEventRiskWindow,
  formatCountdownID,
  isNearWindow,
  type RiskWindowCoverage,
  type RiskWindowSlot,
} from "@/lib/presentation/event-risk-window";
import styles from "./event-risk-window.module.css";

const clockFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false });
const dayFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short" });

function SlotRow({ slot }: { slot: RiskWindowSlot }) {
  const date = new Date(slot.scheduledAt);
  const dateOnly = slot.precision === "DATE_ONLY";
  const near = isNearWindow(slot.minutesUntil);
  return (
    <li className={`${styles.row} ${near ? styles.near : ""}`}>
      <div className={styles.when}>
        <time dateTime={slot.scheduledAt}>{dateOnly ? dayFormat.format(date) : clockFormat.format(date)}</time>
        <small>{dateOnly ? "tanggal" : "WIB"}</small>
      </div>
      <div className={styles.what}>
        <p className={styles.timing}>
          {dateOnly ? "Jam belum ditetapkan oleh sumber ini" : formatCountdownID(slot.minutesUntil ?? 0)}
        </p>
        <ul className={styles.subjects}>
          {slot.entries.map((entry) => (
            <li key={`${slot.key}-${entry.sourceId}-${entry.subject}`}>{entry.subject}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function CoverageNote({ coverage }: { coverage: RiskWindowCoverage }) {
  if (coverage.kind === "NO_CALENDAR_DATA") {
    return <p className={`muted ${styles.note}`}>Belum ada jadwal Forex Factory yang dapat dibaca; bukan bukti tidak ada event.</p>;
  }
  const last = clockFormat.format(new Date(coverage.lastListedAt));
  return <p className={`muted ${styles.note}`}>
    Jadwal Forex Factory terakhir dalam daftar pada {last} WIB.
    {coverage.kind === "TRUNCATED" ? " Daftar mungkin terpotong oleh batas jumlah event." : ""}
    {" "}Kelengkapan sumber untuk seluruh jendela belum terverifikasi.
  </p>;
}

const regionNames = { US: "AS", CHINA: "China", JAPAN: "Jepang" } as const;
const sourceNames = {
  "forex-factory": "Forex Factory",
  biquote: "Biquote",
  "federal-reserve": "Federal Reserve",
} as const;
const horizonDescriptions = {
  CURRENT_WEEK_FEED: "feed pekan berjalan; bukan jaminan tujuh hari",
  BOUNDED_ROLLING_RESPONSE: "respons rolling terbatas; bukan tujuh hari",
  FOMC_DATES_ONLY: "hanya jadwal FOMC; bukan seluruh kalender AS",
} as const;

function coverageLabel(status: CoverageStatus, count: number): string {
  if (status === "KNOWN_EVENTS") return `${count} event tersimpan; kelengkapan belum terbukti`;
  if (status === "QUALIFIED_EMPTY") return "respons kosong dengan bukti cakupan sumber";
  if (status === "READ_ERROR") return "gagal membaca histori";
  return "belum ada bukti cakupan lengkap";
}

function ForwardCoverageNote({ coverage }: { coverage?: CalendarForwardCoverage }) {
  if (!coverage) return <p className={`muted ${styles.note}`}>Cakupan kalender 7 hari belum dapat diverifikasi.</p>;
  return (
    <div className={styles.note} data-testid="calendar-forward-coverage">
      <p><strong>Cakupan kalender 7 hari (AS, China, Jepang)</strong></p>
      <p className="muted">Daftar jadwal yang ditemukan bukan verifikasi bahwa sumber mencakup seluruh tanggal dan wilayah.</p>
      <ul>
        {coverage.regions.map((region) => <li key={region.jurisdiction}>
          {regionNames[region.jurisdiction]}: {coverageLabel(region.status, region.observedEvents)}
        </li>)}
      </ul>
      <ul>
        {coverage.feeds.map((feed) => <li key={feed.sourceId}>
          {sourceNames[feed.sourceId]} ({horizonDescriptions[feed.advertisedHorizon]}):
          {" "}{feed.regions.map((region) =>
            `${regionNames[region.jurisdiction]} — ${coverageLabel(region.status, region.observedEvents)}`
          ).join("; ")}
        </li>)}
      </ul>
      <p className="muted">{coverage.provenanceNote}</p>
    </div>
  );
}

export function EventRiskWindowPanel({ events, asOf, forwardCoverage }: {
  events: Event[]; asOf: string; forwardCoverage?: CalendarForwardCoverage;
}) {
  // Seed with the server-provided dashboard cutoff so first paint already has a
  // deterministic window; switch to the client clock after mount.
  const [now, setNow] = useState(() => new Date(asOf));
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const view = buildEventRiskWindow(events, now, { calendarLimit: ECONOMIC_CALENDAR_LIMIT });

  return (
    <section className="panel" aria-labelledby="event-risk-title">
      <div className="panel-label">
        <span>JENDELA RISIKO EVENT</span>
        <span>{EVENT_RISK_WINDOW_HOURS} JAM KE DEPAN</span>
      </div>
      <h2 id="event-risk-title">Event berdampak tinggi</h2>
      {view && view.slots.length === 0 && (
        <p>Tidak ada event berdampak tinggi yang dimuat dalam {view.windowHours} jam ke depan.</p>
      )}
      {view && view.slots.length > 0 && (
        <ul className={styles.list}>
          {view.slots.map((slot) => (
            <SlotRow slot={slot} key={slot.key} />
          ))}
        </ul>
      )}
      {view && <CoverageNote coverage={view.coverage} />}
      <ForwardCoverageNote coverage={forwardCoverage} />
      <p className={`muted ${styles.note}`}>Hanya jadwal event. Bukan saran entry atau exit.</p>
    </section>
  );
}

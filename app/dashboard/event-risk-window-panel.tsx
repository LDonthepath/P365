"use client";

import { useEffect, useState } from "react";
import type { Event } from "@/lib/domain/types";
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

const SOURCE_LABEL_ID: Record<string, string> = {
  "forex-factory": "Forex Factory",
  "federal-reserve": "Federal Reserve",
  biquote: "Biquote (trial)",
};

const clockFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false });
const dayFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short" });

function sourceLabel(sourceId: string): string {
  return SOURCE_LABEL_ID[sourceId] ?? "Sumber lain";
}

function SlotRow({ slot }: { slot: RiskWindowSlot }) {
  const date = new Date(slot.scheduledAt);
  const dateOnly = slot.precision === "DATE_ONLY";
  const near = isNearWindow(slot.minutesUntil);
  const sources = [...new Set(slot.entries.map((entry) => sourceLabel(entry.sourceId)))].join(", ");
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
        <p className={`muted ${styles.source}`}>{sources}</p>
      </div>
    </li>
  );
}

function CoverageNote({ coverage }: { coverage: RiskWindowCoverage }) {
  if (coverage.kind === "TRUNCATED") {
    return (
      <p className={`muted ${styles.note}`}>
        Kalender hanya memuat event sampai {clockFormat.format(new Date(coverage.knownUntil))} WIB. Event setelah itu belum diketahui, bukan berarti tidak ada.
      </p>
    );
  }
  if (coverage.kind === "NO_CALENDAR_DATA") {
    return <p className={`muted ${styles.note}`}>Kalender Forex Factory tidak memuat event saat ini, jadi daftar ini belum tentu lengkap.</p>;
  }
  return null;
}

export function EventRiskWindowPanel({ events }: { events: Event[] }) {
  // Time-dependent output is computed after mount to avoid a server/client mismatch.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const view = now ? buildEventRiskWindow(events, now, { calendarLimit: ECONOMIC_CALENDAR_LIMIT }) : null;

  return (
    <section className="panel" aria-labelledby="event-risk-title">
      <div className="panel-label">
        <span>JENDELA RISIKO EVENT</span>
        <span>{EVENT_RISK_WINDOW_HOURS} JAM KE DEPAN</span>
      </div>
      <h2 id="event-risk-title">Event berdampak tinggi</h2>
      {!view && <p className="muted">Menghitung jendela waktu…</p>}
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
      <p className={`muted ${styles.note}`}>Hanya jadwal event. Bukan saran entry atau exit.</p>
    </section>
  );
}

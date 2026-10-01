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
  if (coverage.kind === "TRUNCATED") {
    return (
      <p className={`muted ${styles.note}`}>
        Cakupan Forex Factory terverifikasi hanya sampai {clockFormat.format(new Date(coverage.knownUntil))} WIB. Event dari sumber lain masih dapat muncul setelah waktu itu, tetapi daftar setelah batas tersebut belum tentu lengkap.
      </p>
    );
  }
  if (coverage.kind === "NO_CALENDAR_DATA") {
    return <p className={`muted ${styles.note}`}>Forex Factory belum menyediakan kalender pada tampilan ini. Daftar dapat berasal dari sumber lain dan belum tentu lengkap.</p>;
  }
  return null;
}

export function EventRiskWindowPanel({ events, asOf }: { events: Event[]; asOf: string }) {
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
      <p className={`muted ${styles.note}`}>Hanya jadwal event. Bukan saran entry atau exit.</p>
    </section>
  );
}

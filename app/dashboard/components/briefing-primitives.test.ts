import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartCard, KpiCard, SectionHeader, StatusBadge } from "./briefing-primitives";

// Pola SSR JSX yang telah dipakai dalam tes briefing P365.
(globalThis as typeof globalThis & { React?: typeof React }).React = React;
const render = (node: React.ReactElement) => renderToStaticMarkup(node);

test("KpiCard menjaga nilai dan teks pembanding serta menyediakan slot freshness kosong", () => {
  const html = render(createElement(KpiCard, {
    label: "Bitcoin",
    value: "USD 64.000",
    change: { valueLabel: "+1,20%", direction: "up", comparisonLabel: "Dalam 24 jam" },
    badge: createElement(StatusBadge, { label: "Bukti sebagian", tone: "partial" }),
  }));
  assert.match(html, /USD 64\.000/);
  assert.match(html, /\+1,20% \(naik\)/);
  assert.match(html, /Dalam 24 jam/);
  assert.match(html, /Bukti sebagian/);
  assert.match(html, /data-slot="freshness"/);
  assert.doesNotMatch(html, /SEGAR|TERTUNDA|USANG/);
});

test("KpiCard membedakan null, kosong dan perubahan yang tersedia", () => {
  for (const value of [null, undefined, "", "  "]) {
    const html = render(createElement(KpiCard, {
      label: "Emas", value,
      change: { valueLabel: "-1%", direction: "down", comparisonLabel: "Penutupan sebelumnya" },
    }));
    assert.match(html, /—/);
    assert.match(html, /Data belum tersedia/);
    assert.doesNotMatch(html, /Turun · -1%/);
  }
  const html = render(createElement(KpiCard, {
    label: "Emas", value: "USD 2.500",
    change: { valueLabel: "-0,8%", direction: "down", comparisonLabel: "Penutupan sebelumnya" },
  }));
  assert.match(html, /-0,8% \(turun\)/);
  assert.match(html, /var\(--red\)/);
});

test("SectionHeader hanya merender ringkasan yang diberikan dan fallback kosong", () => {
  const html = render(createElement(SectionHeader, {
    title: "01 · Pasar Sekarang",
    summary: "Bitcoin turun 1,1% dalam 24 jam.",
    titleId: "pasar-sekarang",
  }));
  assert.match(html, /id="pasar-sekarang"/);
  assert.match(html, /Bitcoin turun 1,1% dalam 24 jam\./);
  assert.match(render(createElement(SectionHeader, {
    title: "Pasar", summary: null,
  })), /Data belum tersedia/);
});

test("StatusBadge punya teks mandiri tanpa bergantung pada warna", () => {
  for (const tone of ["complete", "partial", "unavailable", "neutral"] as const) {
    const html = render(createElement(StatusBadge, { label: "Bukti belum lengkap", tone }));
    assert.match(html, /Bukti belum lengkap/);
    assert.match(html, /border:1px solid currentColor/);
  }
  assert.match(render(createElement(StatusBadge, { label: "" })), /Status belum tersedia/);
});

test("ChartCard: SVG berlabel, horizon null tidak dijadikan nol, dan tabel rincian", () => {
  const html = render(createElement(ChartCard, {
    title: "Perubahan intraday",
    horizons: [
      { label: "15 menit", valueLabel: "+0,40%", direction: "up", barLengthPercent: 25 },
      { label: "30 menit", valueLabel: null, direction: "unknown", barLengthPercent: null },
      { label: "60 menit", valueLabel: "-1,20%", direction: "down", barLengthPercent: 75 },
      { label: "120 menit", valueLabel: "0,00%", direction: "flat", barLengthPercent: 0 },
    ],
  }));
  assert.match(html, /role="group"/);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="15 menit: \+0,40% \(naik\)"/);
  assert.match(html, /30 menit/);
  assert.match(html, /tidak tersedia/);
  assert.match(html, /-1,20% \(turun\)/);
  assert.match(html, /0,00% \(datar\)/);
  assert.equal((html.match(/<svg /g) ?? []).length, 3);
  assert.match(html, /<details/);
  assert.match(html, /<summary[^>]*>\s*Lihat rincian data\s*<\/summary>/);
  assert.match(html, /<table/);
  assert.match(html, /<th scope="col"/);
  assert.match(html, /<th scope="row"/);
  assert.doesNotMatch(html, /SEGAR|TERTUNDA|USANG|bullish|bearish/i);
});

test("ChartCard: panjang batang tidak valid tidak ditampilkan sebagai nol", () => {
  const html = render(createElement(ChartCard, {
    title: "Perubahan",
    horizons: [
      { label: "15 menit", valueLabel: "+1%", direction: "up", barLengthPercent: null },
      { label: "30 menit", valueLabel: "+2%", direction: "up", barLengthPercent: Number.NaN },
    ],
  }));
  assert.equal((html.match(/<svg /g) ?? []).length, 0);
  assert.equal((html.match(/tidak tersedia/g) ?? []).length, 8);
  const empty = render(createElement(ChartCard, { title: "Perubahan", horizons: [] }));
  assert.match(empty, /Data belum tersedia/);
  assert.doesNotMatch(empty, /<svg|<table/);
});

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const x = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("token teks gelap memiliki kontras WCAG AA minimal 4,5:1", () => {
  const css = readFileSync(new URL("../../globals.css", import.meta.url), "utf8");
  function token(name: string): string {
    const expression = new RegExp("--" + name + ":(#[0-9a-fA-F]{6})");
    const match = css.match(expression);
    assert.ok(match, "Token " + name + " harus ada");
    return match[1];
  }
  const bg = luminance(token("panel"));
  for (const name of ["text", "muted", "lime", "red"]) {
    const fg = luminance(token(name));
    const contrast = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    assert.ok(contrast >= 4.5, name + ": kontras " + contrast.toFixed(2) + ":1");
  }
});

test("font eksplisit pada keempat komponen tidak lebih kecil dari 12px", () => {
  const source = readFileSync(new URL("./briefing-primitives.tsx", import.meta.url), "utf8");
  const sizes = [...source.matchAll(/fontSize:\s*(\d+)/g)].map((match) => Number(match[1]));
  assert.ok(sizes.length >= 10);
  assert.ok(sizes.every((size) => size >= 12));
});

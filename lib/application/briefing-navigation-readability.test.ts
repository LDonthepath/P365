import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../app/dashboard/overview-layout.module.css", import.meta.url),
  "utf8",
);

test("briefing flow keeps readable labels and touch targets", () => {
  assert.match(
    css,
    /\.briefing-flow a\)\{[\s\S]*?min-height:48px;[\s\S]*?display:flex;/,
  );
  assert.match(
    css,
    /\.briefing-flow a span\)\{[\s\S]*?font:700 12px\/1\.35/,
  );
  assert.match(
    css,
    /\.briefing-flow a strong\)\{[\s\S]*?font:600 12px\/1\.3/,
  );
  assert.match(
    css,
    /@media\(max-width:760px\)[\s\S]*?\.briefing-flow a\)\{[\s\S]*?min-height:52px;/,
  );
  assert.match(
    css,
    /@media\(max-width:760px\)[\s\S]*?\.briefing-flow a span\)\{[\s\S]*?font-size:12px;/,
  );
  assert.match(
    css,
    /@media\(max-width:380px\)[\s\S]*?\.briefing-flow\)\{[\s\S]*?overflow-x:auto;/,
  );
});

test("briefing anchors retain the verified top reading offset", () => {
  assert.match(
    css,
    /\.briefing-primary-step\)\{[\s\S]*?scroll-margin-top:18px;/,
  );
  assert.match(
    css,
    /#briefing-market-state-title\)\{[\s\S]*?scroll-margin-top:18px;/,
  );
});

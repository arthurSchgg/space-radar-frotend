"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const radar = fs.readFileSync(path.join(root, "js/radar.js"), "utf8");

test("navegação mobile possui controles e nomes acessíveis", () => {
  for (const view of ["radar", "objects", "controls"]) {
    assert.match(html, new RegExp('data-view="' + view + '" aria-pressed="'));
  }
  assert.match(html, /aria-label="Navegação do radar"/);
  assert.match(html, /id="detailBackdrop"/);
  assert.match(html, /id="resetCamera"/);
  assert.match(app, /function setMobileView\(view\)/);
  assert.match(app, /detailBackdrop/);
});
test("CSS adapta conteúdo para mobile, tablet, landscape e safe areas", () => {
  assert.match(css, /@media \(max-width:900px\)/);
  assert.match(css, /@media \(max-width:350px\)/);
  assert.match(css, /orientation:landscape/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /data-mobile-view="controls"/);
  assert.match(css, /max-height:calc\(100dvh/);
});
test("acabamento 3D e contenção de recursos preservam movimento ilustrativo", () => {
  assert.match(radar, /function atmosphereGlow/);
  assert.match(radar, /function rockShape/);
  assert.match(radar, /function resetCamera/);
  assert.match(radar, /document.hidden/);
  assert.match(radar, /geometry.dispose\(\)/);
  assert.match(radar, /Positions use deterministic, fictional angles/);
  assert.match(html, /VISUALIZAÇÃO ILUSTRATIVA/);
});
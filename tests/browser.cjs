"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const viewportSizes = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 812, height: 375 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 }
];

async function ready(url) {
  for (let i = 0; i < 35; i++) {
    try { const response = await fetch(url); if (response.ok) return; }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("O servidor HTTP não inicializou.");
}

(async () => {
  const server = spawn("python3", ["-m", "http.server", "5500", "--bind", "127.0.0.1"],
    { cwd: root, stdio: "ignore" });
  let browser;
  try {
    await ready("http://127.0.0.1:5500/index.html");
    browser = await chromium.launch({
      headless: true, args: ["--enable-webgl", "--enable-unsafe-swiftshader"]
    });
    const page = await browser.newPage({ viewport: viewportSizes[0], deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
      route => route.fulfill({
        path: path.join(root, "node_modules", "three", "build", "three.min.js"),
        contentType: "application/javascript"
      }));
    await page.route("https://fonts.googleapis.com/**", route => route.abort());
    await page.route("https://fonts.gstatic.com/**", route => route.abort());
    await page.route("https://threejs.org/examples/textures/**", route => route.abort());

    for (const viewport of viewportSizes) {
      await page.setViewportSize(viewport);
      await page.goto("http://127.0.0.1:5500/?demo=1", { waitUntil: "domcontentloaded" });
      await page.locator("#objectList button").first().waitFor({ state: "attached", timeout: 12000 });
      const compact = viewport.width <= 900;
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        navVisible: getComputedStyle(document.querySelector(".mobile-dock")).display !== "none",
        controlsVisible: getComputedStyle(document.querySelector("#controls")).display !== "none",
        objectsVisible: getComputedStyle(document.querySelector(".objects-panel")).display !== "none",
        fictional: document.querySelector("#modeTitle").textContent.includes("DEMONSTRAÇÃO")
      }));
      assert(layout.scrollWidth <= layout.viewport + 1,
        "Overflow horizontal em " + viewport.width + "×" + viewport.height + ": " + JSON.stringify(layout));
      assert.equal(layout.navVisible, compact, "Dock incorreto em " + viewport.width);
      assert(layout.fictional, "Modo de demonstração deve ficar identificado");
      const groups = await page.evaluate(() => {
        const danger = document.querySelectorAll("#objectList .risk-row.hazardous").length;
        const safe = document.querySelectorAll("#objectList .risk-row.safe").length;
        const dangerCount = Number(document.getElementById("riskHazCount").textContent);
        const safeCount = Number(document.getElementById("riskSafeCount").textContent);
        return { danger, safe, dangerCount, safeCount };
      });
      assert(groups.danger > 0 && groups.safe > 0,
        "Demonstração deve conter as duas categorias");
      assert.equal(groups.danger, groups.dangerCount);
      assert.equal(groups.safe, groups.safeCount);
      assert.equal(layout.objectsVisible, !compact, "Lista sobreposta em " + viewport.width);
      assert.equal(layout.controlsVisible, !compact, "Filtros sobrepostos em " + viewport.width);
      if (compact) {
        await page.locator(".mobile-dock button[data-view='objects']").click();
        assert.equal(await page.locator(".objects-panel").isVisible(), true);
        const ready3D = await page.evaluate(() => window.SpaceRadar3D.isReady());
        const overview = await page.evaluate(() => window.SpaceRadar3D.getViewState());
        await page.locator("#objectList button").first().click();
        assert.equal(await page.locator("#detailPanel").isVisible(), true);
        assert.match(await page.locator("#detailRisk").textContent(),
          /POTENCIALMENTE PERIGOSO/);
        if (ready3D) {
          assert.equal(await page.locator("#focusIndicator").isVisible(), true);
          assert.equal(await page.locator(".mobile-dock button[data-view='radar']")
            .getAttribute("aria-pressed"), "true");
          assert.equal(await page.locator("#detailBackdrop").isVisible(), false);
          if (viewport.width === 375) {
            await page.waitForTimeout(1100);
            const closeUp = await page.evaluate(() => window.SpaceRadar3D.getViewState());
            assert(closeUp.selectedId != null, "O foco precisa acompanhar um asteroide");
            assert(closeUp.distance < overview.distance * .65, "Zoom no alvo não ocorreu");
            assert(Math.hypot(closeUp.aim.x, closeUp.aim.y, closeUp.aim.z) > 4,
              "O enquadramento deve mirar o asteroide em vez da Terra");
          }
        }
        await page.locator("#closeDetail").click();
        assert.equal(await page.locator("#detailPanel").isVisible(), false);
        assert.equal(await page.locator("#focusIndicator").isVisible(), false);
        await page.locator(".mobile-dock button[data-view='objects']").click();
        await page.locator("#objectList button.risk-row.safe").first().click();
        assert.match(await page.locator("#detailRisk").textContent(),
          /NÃO CLASSIFICADO COMO PERIGOSO/);
        await page.locator("#closeDetail").click();
        await page.locator(".mobile-dock button[data-view='controls']").click();
        assert.equal(await page.locator("#controls").isVisible(), true);
        await page.locator("#resetCamera").click();
        assert.equal(await page.locator(".mobile-dock button[data-view='radar']")
          .getAttribute("aria-pressed"), "true");
        if (viewport.width === 375) {
          await page.screenshot({ path: path.join(root, "artifacts", "mobile-375.png") });
        }
      } else if (viewport.width === 1440) {
        const ready3D = await page.evaluate(() => window.SpaceRadar3D.isReady());
        const overview = await page.evaluate(() => window.SpaceRadar3D.getViewState());
        await page.locator("#objectList button").first().click();
        assert.equal(await page.locator("#detailPanel").isVisible(), true);
        if (ready3D) {
          await page.waitForTimeout(1200);
          const closeUp = await page.evaluate(() => window.SpaceRadar3D.getViewState());
          assert(closeUp.selectedId, "Asteroide não foi selecionado");
          assert(closeUp.distance < overview.distance * .65, "Câmera não aproximou");
          assert(Math.hypot(closeUp.aim.x, closeUp.aim.y, closeUp.aim.z) > 4,
            "Câmera continua mirando a Terra");
          await page.locator("#focusBack").click();
          await page.waitForTimeout(700);
          const returned = await page.evaluate(() => window.SpaceRadar3D.getViewState());
          assert.equal(returned.selectedId, null, "Seleção não foi limpa");
          assert(returned.distance > closeUp.distance * 1.6, "Câmera não retornou");
        } else {
          await page.locator("#closeDetail").click();
        }
        await page.screenshot({ path: path.join(root, "artifacts", "desktop-1440.png") });
      }
      console.log("PASS " + viewport.width + "×" + viewport.height);
    }
    assert.deepEqual(errors, [], "Exceções JS no navegador");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
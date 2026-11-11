/* Space Radar UI controller — no secret credentials in the browser. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const data = window.SpaceRadarData;
  const radar = window.SpaceRadar3D;
  const config = window.SPACE_RADAR_CONFIG || {};
  const hasAPI = Boolean(String(config.API_BASE_URL || "").trim());
  const requestedDemo = new URLSearchParams(location.search).get("demo") === "1";
  const mode = { demo: requestedDemo || !hasAPI };
  const state = {
    events: [], page: 0, totalPages: 0, totalElements: 0,
    selectedId: null, loading: false, error: null,
    requestId: 0, requestController: null, detailsController: null,
    search: "", hazardousOnly: false
  };
  const preferLessMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pad = x => String(x).padStart(2, "0");
  const formatNumber = (value, maximumFractionDigits = 1) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value);
  };
  const utcLabel = text => {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? "—" :
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "UTC", day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false
      }).format(date) + " UTC";
  };
  const domText = (tag, className, value) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = value;
    return el;
  };

  function initialDates() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(),
      now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start.getTime() + 6 * 86400000);
    $("startDate").value = start.toISOString().slice(0, 10);
    $("endDate").value = end.toISOString().slice(0, 10);
  }

  function query() {
    return {
      startDate: $("startDate").value,
      endDate: $("endDate").value,
      hazardousOnly: state.hazardousOnly,
      maxDistanceKm: $("maxDistance").value ?
        Number($("maxDistance").value) : null,
      page: state.page,
      size: Math.min(100, Math.max(1, Number(config.PAGE_SIZE) || 50))
    };
  }

  function validInterval(q) {
    if (!q.startDate || !q.endDate || q.endDate < q.startDate) {
      return "Escolha um intervalo de datas válido.";
    }
    const start = Date.parse(q.startDate + "T00:00:00Z");
    const end = Date.parse(q.endDate + "T00:00:00Z");
    if (!Number.isFinite(start) || !Number.isFinite(end) ||
        end - start > 365 * 86400000) {
      return "O intervalo máximo do radar é de 365 dias.";
    }
    return null;
  }

  function showToast(message) {
    $("toastText").textContent = String(message || "");
    $("toast").hidden = !message;
  }

  function setStatus(text, kind) {
    $("statusText").textContent = text;
    $("status").classList.toggle("is-demo", kind === "demo");
    $("status").classList.toggle("is-error", kind === "error");
  }

  function updateMode() {
    const badge = $("modeBadge");
    badge.classList.toggle("is-demo", mode.demo);
    $("modeTitle").textContent = mode.demo ? "MODO DEMONSTRAÇÃO" : "NASA / BACKEND";
    $("modeDescription").textContent = mode.demo ?
      "Dados 100% fictícios" : "Dados importados";
    $("demoButton").hidden = mode.demo;
    $("apiButton").hidden = !mode.demo || !hasAPI;
    setStatus(mode.demo ? "Demonstração fictícia" : "API conectada",
      mode.demo ? "demo" : "api");
  }

  function currentVisible() {
    const term = $("search").value.trim().toLocaleLowerCase("pt-BR");
    return !term ? state.events : state.events.filter(item =>
      item.name.toLocaleLowerCase("pt-BR").includes(term) ||
      String(item.nasaId || "").toLocaleLowerCase("pt-BR").includes(term));
  }

  function updateList(visible) {
    const list = $("objectList");
    list.replaceChildren();
    $("totalObjects").textContent = formatNumber(state.totalElements, 0);
    $("hudCount").textContent = pad(visible.length) + " OBJECTS VISIBLE";
    $("pageInfo").textContent = "Página " + (state.page + 1) + " de " +
      Math.max(1, state.totalPages);
    $("prevPage").disabled = state.loading || state.page < 1;
    $("nextPage").disabled = state.loading || state.page + 1 >= state.totalPages;

    if (state.loading || state.error || visible.length === 0) {
      const item = domText("li", "list-placeholder", state.loading
        ? "Consultando eventos de aproximação…"
        : state.error || (state.events.length ?
          "Nenhum objeto corresponde à busca nesta página." :
          "Nenhum objeto encontrado. O intervalo pode não ter sido importado no backend."));
      list.append(item);
      return;
    }
    for (const obj of visible) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = obj.id === state.selectedId ? "is-selected" : "";
      button.setAttribute("aria-pressed", String(obj.id === state.selectedId));
      button.setAttribute("aria-label", "Selecionar " + obj.name +
        ", a " + formatNumber(obj.lunarDistance, 2) + " distâncias lunares");
      const dot = domText("i", "dot " + (obj.hazardous ? "dangerous" : "normal"), "");
      const caption = document.createElement("span");
      caption.append(domText("span", "object-name", obj.name),
        domText("small", "object-subtitle", "NASA ID " + (obj.nasaId || "—")));
      const dist = domText("span", "object-distance",
        formatNumber(obj.lunarDistance, 1) + " DL");
      button.append(dot, caption, dist);
      button.addEventListener("click", () => selectObject(obj.id));
      li.append(button);
      list.append(li);
    }
  }

  function appendMetric(dl, name, value) {
    dl.append(domText("dt", "", name), domText("dd", "", value));
  }

  function updateDetails() {
    const panel = $("detailPanel");
    const obj = state.events.find(item => item.id === state.selectedId);
    if (!obj) { panel.hidden = true; return; }
    panel.hidden = false;
    $("detailRisk").textContent = obj.hazardous ?
      "POTENCIALMENTE PERIGOSO" : "OBJETO MONITORADO";
    $("detailRisk").className = "object-type" +
      (obj.hazardous ? " hazardous" : "");
    $("detailTitle").textContent = obj.name;
    $("detailId").textContent = "NASA ID / " + (obj.nasaId || "—");
    const dl = $("detailMetrics");
    dl.replaceChildren();
    appendMetric(dl, "APROXIMAÇÃO UTC", utcLabel(obj.date));
    appendMetric(dl, "DISTÂNCIA", formatNumber(obj.distanceKm, 0) + " km");
    appendMetric(dl, "DIST. LUNAR", formatNumber(obj.lunarDistance, 2) + " DL");
    appendMetric(dl, "VELOCIDADE", formatNumber(obj.velocityKmS, 2) + " km/s");
    appendMetric(dl, "DIÂMETRO EST.", obj.maxDiameterM != null ?
      formatNumber(obj.maxDiameterM, 0) + " m (máx.)" : "A consultar");
    $("detailNote").textContent = mode.demo ?
      "DEMONSTRAÇÃO: nomes, valores, risco e datas fictícios. O movimento 3D não representa trajetórias reais." :
      "Dados de aproximação da NASA NeoWs. A classificação de perigo potencial não significa colisão prevista. Movimento 3D ilustrativo.";
  }

  function selectObject(id) {
    const visible = currentVisible();
    if (id != null && !visible.some(item => item.id === id)) id = null;
    state.selectedId = id;
    $("controls").open = id == null;
    if (state.detailsController) state.detailsController.abort();
    state.detailsController = null;
    if (radar.isReady()) radar.select(id);
    updateDetails();
    updateList(visible);
    const item = visible.find(obj => obj.id === id);
    if (item && !mode.demo && item.maxDiameterM == null && item.nasaId) {
      const controller = new AbortController();
      state.detailsController = controller;
      const requestedId = id;
      data.fetchAsteroid(item.nasaId, controller.signal).then(extra => {
        if (!extra || state.selectedId !== requestedId) return;
        item.minDiameterM = extra.minDiameterM;
        item.maxDiameterM = extra.maxDiameterM;
        updateDetails();
      }).catch(() => {
        if (state.selectedId === requestedId) {
          $("detailNote").textContent += " Diâmetro não disponível nesta consulta.";
        }
      });
    }
  }

  function renderEvents() {
    const visible = currentVisible();
    if (state.selectedId !== null &&
        !visible.some(item => item.id === state.selectedId)) {
      state.selectedId = null;
      $("detailPanel").hidden = true;
    }
    if (radar.isReady()) {
      radar.setObjects(visible);
      radar.select(state.selectedId);
    }
    updateList(visible);
    updateDetails();
  }

  async function load() {
    const q = query();
    const error = validInterval(q);
    if (error) { showToast(error); return; }
    if (state.requestController) state.requestController.abort();
    state.requestController = new AbortController();
    const task = ++state.requestId;
    state.loading = true;
    state.error = null;
    state.selectedId = null;
    state.events = [];
    state.totalElements = 0;
    state.totalPages = 0;
    $("applyFilters").disabled = true;
    setStatus(mode.demo ? "Preparando demonstração…" : "Consultando API…",
      mode.demo ? "demo" : "api");
    showToast("");
    renderEvents();
    try {
      const result = mode.demo
        ? data.pageDemo(q)
        : await data.fetchEvents(q, state.requestController.signal);
      if (task !== state.requestId) return;
      state.events = result.events.content;
      state.totalElements = result.events.totalElements;
      state.totalPages = result.events.totalPages;
      setStatus(mode.demo ? "Demonstração fictícia" : "API conectada",
        mode.demo ? "demo" : "api");
      $("controls").open = matchMedia("(min-width:701px)").matches;
    } catch (err) {
      if (task !== state.requestId) return;
      state.error = err.message || "Falha ao consultar os dados.";
      setStatus("API indisponível", "error");
      showToast(state.error +
        " Use o botão 'Usar demonstração' para explorar com dados fictícios.");
    } finally {
      if (task === state.requestId) {
        state.loading = false;
        $("applyFilters").disabled = false;
        renderEvents();
      }
    }
  }

  function setMode(demo) {
    mode.demo = Boolean(demo);
    state.page = 0;
    $("search").value = "";
    updateMode();
    load();
  }

  function changeRisk(onlyHazardous) {
    state.hazardousOnly = onlyHazardous;
    state.page = 0;
    $("allFilter").classList.toggle("is-active", !onlyHazardous);
    $("hazardFilter").classList.toggle("is-active", onlyHazardous);
    $("hazardFilter").classList.toggle("is-danger", onlyHazardous);
    $("allFilter").setAttribute("aria-pressed", String(!onlyHazardous));
    $("hazardFilter").setAttribute("aria-pressed", String(onlyHazardous));
    load();
  }

  function setupUI() {
    initialDates();
    updateMode();
    $("controls").open = matchMedia("(min-width:701px)").matches;
    $("allFilter").addEventListener("click", () => changeRisk(false));
    $("hazardFilter").addEventListener("click", () => changeRisk(true));
    $("applyFilters").addEventListener("click", () => {
      state.page = 0;
      load();
    });
    $("search").addEventListener("input", () => renderEvents());
    $("demoButton").addEventListener("click", () => setMode(true));
    $("apiButton").addEventListener("click", () => setMode(false));
    $("prevPage").addEventListener("click", () => {
      if (state.page > 0) { state.page--; load(); }
    });
    $("nextPage").addEventListener("click", () => {
      if (state.page + 1 < state.totalPages) { state.page++; load(); }
    });
    $("closeDetail").addEventListener("click", () => selectObject(null));
    $("closeToast").addEventListener("click", () => showToast(""));
    $("speed").addEventListener("input", e => {
      const value = Number(e.target.value);
      $("speedValue").textContent = value.toFixed(1) + "×";
      radar.setSpeed(value);
    });
    $("sweep").addEventListener("change", e => radar.setSweep(e.target.checked));
    $("galaxy").addEventListener("change", e => radar.setGalaxy(e.target.checked));
    $("autoRotate").addEventListener("change", e =>
      radar.setAutoRotate(e.target.checked));
    if (preferLessMotion) {
      $("speed").value = "0";
      $("speedValue").textContent = "0.0×";
      $("autoRotate").checked = false;
    }
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        showToast("");
        selectObject(null);
      }
    });
  }

  function init() {
    setupUI();
    const is3D = radar.init(selectObject);
    if (is3D) {
      radar.setSpeed(Number($("speed").value));
      radar.setSweep($("sweep").checked);
      radar.setGalaxy($("galaxy").checked);
      radar.setAutoRotate($("autoRotate").checked);
    }
    load();
  }
  document.addEventListener("DOMContentLoaded", init);
})();

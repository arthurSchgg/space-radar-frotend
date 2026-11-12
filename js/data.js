/* NASA NeoWs backend adapter + deliberately fictional demo generator. */
window.SpaceRadarData = (() => {
  "use strict";
  const MOON_DISTANCE_KM = 384400;
  const MAX_EVENTS = 250;
  const MSEC_DAY = 86400000;
  const safeNumber = (value) => typeof value === "number" && Number.isFinite(value)
    ? value : null;

  function dateStringUTC(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const at = new Date(raw.approachAtUtc);
    const distanceKm = safeNumber(raw.distanceKm);
    const velocityKmS = safeNumber(raw.velocityKmS);
    if (Number.isNaN(at.getTime()) || distanceKm === null || distanceKm < 0 ||
        velocityKmS === null || velocityKmS < 0) return null;
    const lunarDistance = safeNumber(raw.lunarDistance);
    return {
      id: String(raw.id == null ? String(raw.nasaId || "") + at.toISOString() : raw.id),
      asteroidId: raw.asteroidId == null ? "" : String(raw.asteroidId),
      nasaId: raw.nasaId == null ? null : String(raw.nasaId),
      name: String(raw.asteroidName || "Objeto sem nome").slice(0, 120),
      hazardous: raw.hazardous === true,
      date: at.toISOString(),
      velocityKmS,
      distanceKm,
      lunarDistance: lunarDistance == null
        ? distanceKm / MOON_DISTANCE_KM : lunarDistance,
      minDiameterM: safeNumber(raw.minDiameterM),
      maxDiameterM: safeNumber(raw.maxDiameterM),
      fictional: raw.fictional === true
    };
  }

  // Deterministic seeded random (only for illustration).
  function randomSeed(seed) {
    let s = seed >>> 0;
    return () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function demoObjects(reference = new Date()) {
    const rand = randomSeed(120891);
    const midnight = Date.UTC(reference.getUTCFullYear(),
      reference.getUTCMonth(), reference.getUTCDate());
    return Array.from({ length: 48 }, (_, i) => {
      const lunar = 0.3 + Math.pow(rand(), 1.8) * 67;
      const diameter = 12 + Math.pow(rand(), 2.6) * 980;
      const velocity = 5 + rand() * 36;
      const day = i % 7;
      const minute = Math.floor(rand() * 1440);
      const when = new Date(midnight + day * MSEC_DAY + minute * 60000);
      const code = "DEMO-NEO-" + String(i + 1).padStart(3, "0");
      return normalize({
        id: "demo-" + i,
        asteroidId: "demo-asteroid-" + i,
        nasaId: "DEMO-" + (i + 1),
        asteroidName: code,
        hazardous: diameter > 150 && lunar < 22,
        distanceKm: lunar * MOON_DISTANCE_KM,
        lunarDistance: lunar,
        velocityKmS: velocity,
        minDiameterM: diameter * .62,
        maxDiameterM: diameter,
        approachAtUtc: when.toISOString(),
        fictional: true
      });
    });
  }

  function pageDemo(query, reference = new Date()) {
    const from = Date.parse(query.startDate + "T00:00:00.000Z");
    const to = Date.parse(query.endDate + "T23:59:59.999Z");
    const events = demoObjects(reference)
      .filter(item => {
        const at = Date.parse(item.date);
        return at >= from && at <= to
          && (!query.hazardousOnly || item.hazardous)
          && (query.maxDistanceKm == null || item.distanceKm <= query.maxDistanceKm);
      })
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const size = Math.min(100, Math.max(1, query.size || 50));
    const page = Math.max(0, query.page || 0);
    return {
      fictional: true,
      visualizationMode: "SCHEMATIC_DISTANCE_ONLY",
      realTimeCoordinatesAvailable: false,
      startDate: query.startDate,
      endDate: query.endDate,
      events: {
        content: events.slice(page * size, (page + 1) * size),
        page, size,
        totalElements: events.length,
        totalPages: Math.ceil(events.length / size)
      }
    };
  }

  function apiBase() {
    const config = window.SPACE_RADAR_CONFIG || {};
    const url = String(config.API_BASE_URL || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\/[^ ]+/i.test(url)) throw new Error("API não configurada em js/config.js.");
    if (typeof location !== "undefined" && location.protocol === "https:"
        && /^http:\/\//i.test(url)) {
      throw new Error("O frontend HTTPS exige uma API com endereço HTTPS.");
    }
    return url;
  }

  async function requestJSON(path, params, signal) {
    const endpoint = new URL(apiBase() + path);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        endpoint.searchParams.set(key, String(value));
      }
    });
    const config = window.SPACE_RADAR_CONFIG || {};
    const ctrl = new AbortController();
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const abort = () => ctrl.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => ctrl.abort(), config.REQUEST_TIMEOUT_MS || 16000);
    try {
      const response = await fetch(endpoint.toString(), {
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("A API respondeu HTTP " + response.status + ".");
      }
      return await response.json();
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("A conexão foi interrompida ou excedeu o tempo limite.");
      }
      if (error instanceof TypeError) {
        throw new Error("Não foi possível acessar a API. Confira o endereço, o CORS e o backend.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

  async function fetchEvents(query, signal) {
    const body = await requestJSON("/v1/radar", {
      startDate: query.startDate, endDate: query.endDate,
      hazardousOnly: query.hazardousOnly,
      maxDistanceKm: query.maxDistanceKm,
      page: query.page, size: query.size
    }, signal);
    if (!body || !body.events || !Array.isArray(body.events.content) ||
        !Number.isInteger(body.events.totalElements) ||
        !Number.isInteger(body.events.totalPages)) {
      throw new Error("A resposta da API não segue o contrato /v1/radar.");
    }
    return {
      ...body,
      fictional: false,
      events: {
        ...body.events,
        content: body.events.content.slice(0, MAX_EVENTS).map(normalize).filter(Boolean)
      }
    };
  }

  async function fetchAsteroid(nasaId, signal) {
    if (nasaId == null || !/^\d+$/.test(String(nasaId))) return null;
    const raw = await requestJSON("/v1/space-radar/" + encodeURIComponent(nasaId), {}, signal);
    if (!raw || String(raw.nasaId) !== String(nasaId)) return null;
    return {
      minDiameterM: safeNumber(raw.minDiameterM),
      maxDiameterM: safeNumber(raw.maxDiameterM),
      nasaJplUrl: typeof raw.nasaJplUrl === "string" &&
        /^https:\/\/ssd\.jpl\.nasa\.gov\//i.test(raw.nasaJplUrl)
        ? raw.nasaJplUrl : null
    };
  }
  return Object.freeze({
    MOON_DISTANCE_KM, normalize, dateStringUTC,
    demoObjects, pageDemo, fetchEvents, fetchAsteroid
  });
})();

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

global.window = global;
require("../js/data.js");
const radarData = global.SpaceRadarData;
const today = new Date("2026-11-11T12:00:00.000Z");

test("demo data is explicitly fictional, deterministic and nonempty", () => {
  const one = radarData.demoObjects(today);
  const two = radarData.demoObjects(today);
  assert.equal(one.length, 48);
  assert.deepEqual(one, two);
  assert(one.every(item => item.fictional && item.name.startsWith("DEMO-NEO-")));
  assert(one.every(item => Number.isFinite(item.distanceKm) && item.distanceKm >= 0));
});

test("the demonstration respects risk, distance, time and pagination", () => {
  const q = {
    startDate: "2026-11-11", endDate: "2026-11-17",
    hazardousOnly: true, maxDistanceKm: 10000000, page: 0, size: 5
  };
  const first = radarData.pageDemo(q, today);
  assert.equal(first.realTimeCoordinatesAvailable, false);
  assert.equal(first.visualizationMode, "SCHEMATIC_DISTANCE_ONLY");
  assert(first.events.totalElements > 0);
  assert(first.events.content.length <= 5);
  assert(first.events.content.every(item =>
    item.hazardous && item.distanceKm <= q.maxDistanceKm));
  const next = radarData.pageDemo({ ...q, page: 1 }, today);
  assert.equal(next.events.page, 1);
  assert(!next.events.content.some(obj =>
    first.events.content.some(previous => previous.id === obj.id)));
});

test("adapter accepts the backend response DTO", () => {
  const obj = radarData.normalize({
    id: "id-123", asteroidId: "uuid",
    nasaId: 2000433, asteroidName: "(2026 NP)",
    hazardous: true, approachAtUtc: "2026-11-11T15:12:00Z",
    velocityKmS: 19.88, distanceKm: 960000, lunarDistance: 2.5
  });
  assert.equal(obj.id, "id-123");
  assert.equal(obj.nasaId, "2000433");
  assert.equal(obj.name, "(2026 NP)");
  assert.equal(obj.lunarDistance, 2.5);
  assert.equal(obj.fictional, false);
});

test("adapter fills missing lunar distance with approximate conversion", () => {
  const item = radarData.normalize({
    nasaId: 10, asteroidName: "test",
    approachAtUtc: "2026-11-11T15:12:00Z",
    velocityKmS: 1, distanceKm: radarData.MOON_DISTANCE_KM
  });
  assert.equal(item.lunarDistance, 1);
});

test("adapter rejects malformed or physically impossible values", () => {
  assert.equal(radarData.normalize(null), null);
  assert.equal(radarData.normalize({ approachAtUtc: "broken",
    velocityKmS: 12, distanceKm: 30 }), null);
  assert.equal(radarData.normalize({ approachAtUtc: "2026-11-11T15:12:00Z",
    velocityKmS: 12, distanceKm: -5 }), null);
  assert.equal(radarData.normalize({ approachAtUtc: "2026-11-11T15:12:00Z",
    velocityKmS: -2, distanceKm: 5 }), null);
});

test("date conversion is UTC based", () => {
  assert.equal(radarData.dateStringUTC("2026-11-11T23:59:00Z"), "2026-11-11");
  assert.equal(radarData.dateStringUTC("invalid"), null);
});

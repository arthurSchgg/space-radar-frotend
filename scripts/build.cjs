#!/usr/bin/env node
"use strict";

/*
 * Vercel build: publish the static site with ONLY its public HTTPS API origin.
 * Secrets such as NASA_API_KEY and RADAR_ADMIN_TOKEN must stay in the backend.
 */
const fs = require("node:fs");
const path = require("node:path");

const raw = (process.env.SPACE_RADAR_API_URL || "").trim();
if (!raw) {
  console.error("SPACE_RADAR_API_URL is required. Set it to the Render API HTTPS origin in Vercel.");
  process.exit(1);
}

let apiUrl;
try {
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("Expected a bare HTTPS origin (no path, credentials or query).");
  }
  apiUrl = parsed.origin;
} catch {
  console.error("Invalid SPACE_RADAR_API_URL: provide an HTTPS origin, e.g. https://api.example.com");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const item of ["index.html", "assets", "css", "js"]) {
  fs.cpSync(path.join(root, item), path.join(dist, item), { recursive: true });
}

const configuration = [
  "/* Generated at build time with the PUBLIC backend URL; do not add secrets. */",
  "window.SPACE_RADAR_CONFIG = Object.freeze({",
  "  API_BASE_URL: " + JSON.stringify(apiUrl) + ",",
  "  REQUEST_TIMEOUT_MS: 90000,",
  "  PAGE_SIZE: 50",
  "});",
  ""
].join("\n");
fs.writeFileSync(path.join(dist, "js", "config.js"), configuration, "utf8");
console.log("Static Space Radar bundle generated in dist/ with public HTTPS backend origin.");

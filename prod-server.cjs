/* eslint-disable */
// ============================================================
// pm2 entry point for veloria-prod (see ecosystem.config.js).
//
// Starts Next's standalone server, but first fixes the two mistakes that took
// production down twice on 23 Nov 2026 (and before that in September):
//
//  1. Wrong address. Apache proxies app.theveloriagrand.com to 127.0.0.1:3010.
//     `pm2 restart all --update-env` from a login shell copies the shell's
//     HOSTNAME (43-225-53-88.cprapid.com) into the app, Next binds to the public
//     IP, and every request gets a 503. So HOSTNAME, PORT and TZ are set here,
//     whatever the environment says. (TZ=UTC: the server runs on New York time
//     and date logic assumes UTC.)
//
//  2. Missing static files. `next build` writes the server to .next/standalone
//     but leaves the browser files (.next/static) and public/ outside it; a
//     deploy that forgets to copy them serves pages with no CSS, no JS and no
//     icons while /api/health still says 200. If either is missing from the
//     standalone folder, it is copied from the files the same build produced.
//
// Lives outside .next/ on purpose: `next build` wipes .next, this file survives.
// ============================================================
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const STANDALONE = path.join(ROOT, ".next", "standalone");

// Only for test-starting a copy of production on a spare port. Nothing exports
// this by accident; a shell's PORT/HOSTNAME are exactly what we must ignore.
const port = /^\d{2,5}$/.test(process.env.VELORIA_GUARD_PORT || "") ? process.env.VELORIA_GUARD_PORT : "3010";

const forced = { HOSTNAME: "127.0.0.1", PORT: port, TZ: "UTC" };
for (const [key, value] of Object.entries(forced)) {
  if (process.env[key] !== value) {
    if (process.env[key]) {
      console.warn(`[prod-server] ignoring ${key}=${process.env[key]} from the environment, using ${value}`);
    }
    process.env[key] = value;
  }
}

// A real copy, not a symlink: the safe deploy keeps the previous standalone
// folder for rollback and rsyncs ITS static files back over .next/static. A link
// there would point at the new build's files and the rollback would bring back
// pages whose JS/CSS no longer exist. (~20 MB, well under a second.)
function ensurePresent(source, dest, label) {
  if (fs.existsSync(dest)) return;
  if (!fs.existsSync(source)) {
    console.error(`[prod-server] ${label} is missing from the build and ${source} does not exist either; pages will load without it`);
    return;
  }
  // Every cluster worker starts at once: each copies into its own temp folder,
  // the first rename wins, the rest throw theirs away.
  const tmp = `${dest}.tmp-${process.pid}`;
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.cpSync(source, tmp, { recursive: true });
    fs.renameSync(tmp, dest);
    console.warn(`[prod-server] ${label} was missing from the build; copied it from ${source}`);
  } catch (err) {
    fs.rmSync(tmp, { recursive: true, force: true });
    if (fs.existsSync(dest)) return; // another worker got there first
    console.error(`[prod-server] could not copy ${label}: ${err && err.message}`);
  }
}

ensurePresent(path.join(ROOT, ".next", "static"), path.join(STANDALONE, ".next", "static"), "browser files (.next/static)");
ensurePresent(path.join(ROOT, "public"), path.join(STANDALONE, "public"), "public/ (icons, manifest, embed scripts)");

require(path.join(STANDALONE, "server.js"));

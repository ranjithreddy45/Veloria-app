#!/usr/bin/env node
// R1-10: every process.env.NAME the code reads must be listed in .env.example.
// Usage: node scripts/check-env-example.mjs   (exit 1 and print the missing names)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Set by the platform or the toolchain, never by us.
const IGNORE = new Set(["NODE_ENV", "NEXT_RUNTIME", "CI", "VERCEL", "VERCEL_ENV", "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_GIT_COMMIT_SHA", "NEXT_PHASE", "PORT", "HOSTNAME", "TZ", "npm_package_version"]);

const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx' '*.ts' 'prisma/*.ts' 'scripts/*.ts' 'scripts/*.mjs'", { encoding: "utf8" })
  .split("\n").filter((f) => f && !/\.test\.tsx?$/.test(f) && !f.startsWith("tests/"));
const used = new Set();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) used.add(m[1]);
  for (const m of src.matchAll(/process\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g)) used.add(m[1]);
}
const listed = new Set(
  readFileSync(".env.example", "utf8").split("\n")
    .map((l) => l.replace(/^#\s*/, "").match(/^([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean),
);
const missing = [...used].filter((n) => !listed.has(n) && !IGNORE.has(n)).sort();
if (missing.length) {
  console.log(`Missing from .env.example (${missing.length}):\n` + missing.join("\n"));
  process.exit(1);
}
console.log(`.env.example lists all ${used.size - [...used].filter((n) => IGNORE.has(n)).length} variables the code reads.`);

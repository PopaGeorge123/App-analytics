/**
 * Fixes the integration-connected email calls from fire-and-forget
 * to properly awaited (so Next.js serverless doesn't kill the promise).
 *
 * Run: node scripts/fix-connected-email-await.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const AUTH_DIR = new URL("../app/api/auth", import.meta.url).pathname;

function findCallbackRoutes(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...findCallbackRoutes(full));
    else if (full.endsWith("callback/route.ts")) results.push(full);
  }
  return results;
}

const routes = findCallbackRoutes(AUTH_DIR);
let patched = 0;
let skipped = 0;

for (const filePath of routes) {
  let src = readFileSync(filePath, "utf8");

  // Only touch files that still have the fire-and-forget pattern
  if (!src.includes("notifyIntegrationConnected(state,") || !src.includes(".catch(() => {})")) {
    skipped++;
    continue;
  }

  // Replace:
  //   notifyIntegrationConnected(state, "xxx").catch(() => {});
  //   return NextResponse.redirect(...)
  // With:
  //   await notifyIntegrationConnected(state, "xxx");
  //   return NextResponse.redirect(...)
  src = src.replace(
    /    notifyIntegrationConnected\(state, "([^"]+)"\)\.catch\(\(\) => \{\}\);/g,
    `    await notifyIntegrationConnected(state, "$1");`
  );

  writeFileSync(filePath, src, "utf8");
  console.log(`  ✓  Fixed [await] ${relative(process.cwd(), filePath)}`);
  patched++;
}

console.log(`\nDone. Fixed: ${patched}  Skipped: ${skipped}`);

/**
 * Injects the `notifyIntegrationConnected` call into every API-key
 * /connect/route.ts that returns { success: true }.
 *
 * Run: node scripts/inject-connected-email-connect.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const AUTH_DIR = new URL("../app/api/auth", import.meta.url).pathname;

const IMPORT_LINE = `import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";`;

function findConnectRoutes(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...findConnectRoutes(full));
    else if (full.endsWith("connect/route.ts")) results.push(full);
  }
  return results;
}

const routes = findConnectRoutes(AUTH_DIR);
let patched = 0;
let skipped = 0;

for (const filePath of routes) {
  let src = readFileSync(filePath, "utf8");

  // Skip if already patched
  if (src.includes("notifyIntegrationConnected")) {
    skipped++;
    continue;
  }

  // Must have a success JSON response
  if (!src.includes('{ success: true }')) {
    console.warn(`  ⚠  No success pattern found: ${relative(process.cwd(), filePath)}`);
    skipped++;
    continue;
  }

  // Derive platform from directory: app/api/auth/{platform}/connect/route.ts
  const parts = filePath.split("/");
  const connectIdx = parts.indexOf("connect");
  const platform = parts[connectIdx - 1];

  // 1. Inject import after the last import line
  const lines = src.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImportIdx = i;
  }
  if (lastImportIdx === -1) { skipped++; continue; }
  lines.splice(lastImportIdx + 1, 0, IMPORT_LINE);
  src = lines.join("\n");

  // 2. Before `return NextResponse.json({ success: true })`, inject the await call.
  //    The user object is always available at this point as `user`.
  src = src.replace(
    /(\s+)(return NextResponse\.json\(\{ success: true \}\);)/,
    `$1await notifyIntegrationConnected(user.id, "${platform}");\n$1$2`
  );

  writeFileSync(filePath, src, "utf8");
  console.log(`  ✓  Patched [${platform}]  ${relative(process.cwd(), filePath)}`);
  patched++;
}

console.log(`\nDone. Patched: ${patched}  Skipped: ${skipped}`);

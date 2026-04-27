/**
 * Injects the `notifyIntegrationConnected` call into every OAuth callback
 * route that has a successful redirect with `syncing=`.
 *
 * Run: node scripts/inject-connected-email.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const AUTH_DIR = new URL("../app/api/auth", import.meta.url).pathname;

const IMPORT_LINE = `import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";`;

// Walk all callback/route.ts files under app/api/auth/
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

  // Skip if already patched
  if (src.includes("notifyIntegrationConnected")) {
    skipped++;
    continue;
  }

  // Derive the platform from the directory name: app/api/auth/{platform}/callback/route.ts
  const parts = filePath.split("/");
  const callbackIdx = parts.indexOf("callback");
  const platform = parts[callbackIdx - 1]; // folder right before "callback"

  // Only patch files that have a syncing= success redirect
  if (!src.includes("syncing=")) {
    skipped++;
    continue;
  }

  // 1. Inject import after the last existing import line
  // Find the last import line index
  const lines = src.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImportIdx = i;
  }
  if (lastImportIdx === -1) {
    console.warn(`  ⚠  Could not find import block in ${relative(process.cwd(), filePath)}`);
    skipped++;
    continue;
  }
  lines.splice(lastImportIdx + 1, 0, IMPORT_LINE);
  src = lines.join("\n");

  // 2. After `await handle*Callback(`, on the same try-block success path,
  //    inject the notification call on the very next line.
  //    Pattern: "    await handleXxxCallback(state, code);\n"
  src = src.replace(
    /(    await handle\w+\(state, code\);)\n(\s+return NextResponse\.redirect)/,
    `$1\n    notifyIntegrationConnected(state, "${platform}").catch(() => {});\n$2`
  );

  writeFileSync(filePath, src, "utf8");
  console.log(`  ✓  Patched [${platform}]  ${relative(process.cwd(), filePath)}`);
  patched++;
}

console.log(`\nDone. Patched: ${patched}  Skipped: ${skipped}`);

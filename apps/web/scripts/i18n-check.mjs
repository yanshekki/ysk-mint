#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/shared/i18n");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

function leaves(obj, prefix = "") {
  const out = [];
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      if (item && typeof item === "object") out.push(...leaves(item, `${prefix}[${i}]`));
      else out.push(`${prefix}[${i}]`);
    });
    return out;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object") out.push(...leaves(v, path));
      else out.push(path);
    }
  }
  return out;
}

const packs = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8"))]));
const enKeys = new Set(leaves(packs["en.json"]));
let failed = 0;
for (const [file, data] of Object.entries(packs)) {
  const keys = new Set(leaves(data));
  const missing = [...enKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !enKeys.has(k));
  if (missing.length || extra.length) {
    failed += 1;
    console.error(`${file}: missing ${missing.length}, extra ${extra.length}`);
    if (missing.length) console.error("  missing", missing.slice(0, 20).join(", "));
    if (extra.length) console.error("  extra", extra.slice(0, 20).join(", "));
  }
}
if (failed) process.exit(1);
console.log(`i18n key check ok (${files.length} files, ${enKeys.size} leaf keys)`);

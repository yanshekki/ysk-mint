#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pairs = [
  ["README.md", "README-ZH.md"],
  ["docs/architecture.md", "docs/architecture-ZH.md"],
  ["docs/errors.md", "docs/errors-ZH.md"],
  ["docs/phases.md", "docs/phases-ZH.md"],
  ["docs/security-checklist.md", "docs/security-checklist-ZH.md"],
];

function headings(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => /^#{1,3} /.test(line))
    .map((line) => line.replace(/^(#{1,3}) .+$/, "$1").length);
}

let failed = 0;
for (const [en, zh] of pairs) {
  const a = join(root, en);
  const b = join(root, zh);
  if (!existsSync(a) || !existsSync(b)) {
    console.error(`missing pair: ${en} / ${zh}`);
    failed += 1;
    continue;
  }
  const ha = headings(a);
  const hb = headings(b);
  if (ha.length !== hb.length || ha.some((v, i) => v !== hb[i])) {
    console.error(`heading structure mismatch: ${en} vs ${zh} (${ha.length} vs ${hb.length})`);
    failed += 1;
  }
}

if (failed) {
  process.exit(1);
}
console.log(`docs bilingual check ok (${pairs.length} pairs)`);

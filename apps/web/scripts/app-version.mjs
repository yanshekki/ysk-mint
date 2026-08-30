import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(web, "package.json"), "utf8"));

export function appVersion() {
  return String(pkg.version || "0");
}

export function appBuild() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: web,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  }
}

export function appRelease() {
  return { version: appVersion(), build: appBuild() };
}

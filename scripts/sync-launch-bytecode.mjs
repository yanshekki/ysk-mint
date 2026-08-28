import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "packages/contracts/out");

function bytecode(sol, name) {
  const json = JSON.parse(readFileSync(join(out, sol, `${name}.json`), "utf8"));
  const hex = json.bytecode?.object;
  if (!hex || !hex.startsWith("0x")) throw new Error(`missing bytecode ${sol}/${name}`);
  return hex;
}

const src = `/** Generated from packages/contracts/out. Do not edit by hand. */
export const LAUNCH_BYTECODE = {
  tokenFactory: "${bytecode("TokenFactory.sol", "TokenFactory")}" as const,
  liquidityLocker: "${bytecode("LiquidityLocker.sol", "LiquidityLocker")}" as const,
  liquidityManager: "${bytecode("LiquidityManager.sol", "LiquidityManager")}" as const,
  mockV2Router: "${bytecode("MockV2Router.sol", "MockV2Router")}" as const,
} as const;
`;

writeFileSync(join(root, "apps/web/src/lib/launchBytecode.ts"), src);
console.log("wrote apps/web/src/lib/launchBytecode.ts");

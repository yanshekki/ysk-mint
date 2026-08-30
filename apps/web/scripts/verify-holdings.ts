/**
 * Holdings parity: native / token pagination / stake vs public APIs.
 *
 * CLI (or env VERIFY_*):
 *   --evm 0x... --near acct.near --ada addr1... --sol ... --sui 0x...
 *   --tron T... --atom cosmos1... --osmo osmo1... --tia celestia1...
 *   --xrp r... --apt 0x...
 */
import { fetchAptos, fetchCosmosBank, fetchSui, fetchTron, fetchXrpl } from "../src/lib/holdings/rest.ts";
import { fetchSolana } from "../src/lib/holdings/solana.ts";
import { explorerUrl } from "../src/lib/evmDiscover.ts";
import { readCosmosStake } from "../src/lib/stake/cosmos.ts";
import { readSuiStake } from "../src/lib/stake/sui.ts";
import { readTronStake, tronFrozenSun } from "../src/lib/stake/tron.ts";
import { readNearStake } from "../src/lib/stake/near.ts";
import { readSolStake } from "../src/lib/stake/sol.ts";
import { koiosPost } from "../src/lib/koios.ts";
import { rpcJsonRpc } from "../src/lib/rpcPool.ts";

const LCD: Record<number, { url: string; denom: string; symbol: string }> = {
  118: { url: "https://cosmos-rest.publicnode.com", denom: "uatom", symbol: "ATOM" },
  100001: { url: "https://osmosis-rest.publicnode.com", denom: "uosmo", symbol: "OSMO" },
  100002: { url: "https://celestia-rest.publicnode.com", denom: "utia", symbol: "TIA" },
};

const WHALES = {
  xrpl: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  osmosis: "osmo1clpqr4nrk4khgkxj78fcwwh6dl3uw4epasmvnj",
};

let fails = 0;
let skips = 0;

function arg(name: string) {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith("--")) return process.argv[i + 1]!;
  return process.env[`VERIFY_${name.toUpperCase()}`] ?? "";
}

function fail(msg: string, data: Record<string, unknown> = {}) {
  fails += 1;
  console.error("FAIL", msg, Object.keys(data).length ? JSON.stringify(data) : "");
}

function pass(msg: string, data: Record<string, unknown> = {}) {
  console.log("OK  ", msg, Object.keys(data).length ? JSON.stringify(data) : "");
}

function skip(msg: string) {
  skips += 1;
  console.log("SKIP", msg);
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ac.signal,
      headers: { accept: "application/json", "user-agent": "ysk-mint-verify/1.0", ...init?.headers },
    });
    if (!res.ok) return { __status: res.status };
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function rpc(url: string, method: string, params: unknown) {
  const json = (await getJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })) as { result?: unknown } | null;
  return json && "result" in json ? json.result : null;
}

function tokenN(map: Map<string, { raw: bigint }>) {
  let n = 0;
  for (const [k, v] of map) if (k !== "native" && v.raw > 0n) n += 1;
  return n;
}

async function cosmosFirstPage(lcd: string, addr: string) {
  const json = (await getJson(`${lcd.replace(/\/+$/, "")}/cosmos/bank/v1beta1/balances/${addr}?pagination.limit=200`)) as {
    balances?: unknown[];
    pagination?: { next_key?: string | null };
    __status?: number;
  } | null;
  if (!json || json.__status) return null;
  return { n: json.balances?.length ?? 0, next: Boolean(json.pagination?.next_key) };
}

async function xrplFirstLines(addr: string) {
  const json = (await getJson("https://xrplcluster.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "account_lines", params: [{ account: addr, ledger_index: "validated", limit: 400 }] }),
  })) as { result?: { lines?: unknown[]; marker?: unknown } } | null;
  if (!json?.result) return null;
  return { n: json.result.lines?.length ?? 0, next: Boolean(json.result.marker) };
}

async function checkCosmos(chainId: number, addr: string, label: string) {
  const meta = LCD[chainId];
  if (!meta) return;
  const first = await cosmosFirstPage(meta.url, addr);
  if (!first) {
    skip(`${label} lcd`);
    return;
  }
  const app = await fetchCosmosBank(chainId, meta.denom, meta.symbol, addr);
  const appN = tokenN(app) + (app.get("native") ? 1 : 0);
  if (first.next && appN <= first.n) fail(`${label} truncated bank page`, { first: first.n, app: appN });
  else pass(`${label} bank`, { first: first.n, app: appN, paged: first.next });

  const dels = (await getJson(`${meta.url}/cosmos/staking/v1beta1/delegations/${addr}?pagination.limit=200`)) as {
    delegation_responses?: Array<{ balance?: { amount?: string } }>;
  } | null;
  let locked = 0n;
  for (const d of dels?.delegation_responses ?? []) {
    try {
      locked += BigInt(d.balance?.amount || "0");
    } catch {
      /* skip */
    }
  }
  const stake = await readCosmosStake(chainId, addr).catch(() => []);
  const stakeRaw = stake.reduce((s, l) => s + l.raw, 0n);
  if (locked > 0n && stakeRaw === 0n) fail(`${label} missing stake desk`, { locked: locked.toString() });
  else if (locked > 0n) pass(`${label} stake`, { locked: locked.toString(), desk: stakeRaw.toString() });
  else pass(`${label} stake none`);
}

async function checkXrpl(addr: string, label: string) {
  const first = await xrplFirstLines(addr);
  if (!first) {
    skip(`${label} xrpl`);
    return;
  }
  const app = await fetchXrpl(addr);
  const appN = tokenN(app);
  if (first.next && appN <= first.n) fail(`${label} truncated trust lines`, { first: first.n, app: appN });
  else pass(`${label} xrpl`, { first: first.n, app: appN, paged: first.next, native: app.get("native")?.raw.toString() });
}

async function checkSui(addr: string) {
  const app = await fetchSui(addr);
  const alt = await rpcJsonRpc<Array<{ coinType: string; totalBalance: string }>>(784, "suix_getAllBalances", [addr]);
  const altN = (alt ?? []).filter((c) => BigInt(c.totalBalance || "0") > 0n).length;
  const appN = tokenN(app) + (app.get("native") && app.get("native")!.raw > 0n ? 1 : 0);
  if (altN > 0 && appN === 0) fail("sui empty vs rpc", { altN });
  else pass("sui balances", { appN, altN, native: app.get("native")?.raw.toString() });
  const stakes = await rpcJsonRpc<Array<{ stakes?: Array<{ principal?: string }> }>>(784, "suix_getStakes", [addr]);
  let locked = 0n;
  for (const s of stakes ?? []) for (const p of s.stakes ?? []) locked += BigInt(p.principal || "0");
  const desk = await readSuiStake(addr).catch(() => []);
  const deskRaw = desk.reduce((s, l) => s + l.raw, 0n);
  if (locked > 0n && deskRaw === 0n) fail("sui missing stake desk", { locked: locked.toString() });
  else if (locked > 0n) pass("sui stake", { locked: locked.toString(), desk: deskRaw.toString() });
  else pass("sui stake none");
}

async function checkTron(addr: string) {
  const app = await fetchTron(addr);
  const json = (await getJson(`https://api.trongrid.io/v1/accounts/${addr}`)) as { data?: Array<Record<string, unknown>> } | null;
  const acc = json?.data?.[0];
  const spend = BigInt(Number(acc?.balance ?? 0));
  const frozen = tronFrozenSun(acc);
  if (app.get("native")?.raw !== spend && spend > 0n) fail("tron native mismatch", { app: app.get("native")?.raw.toString(), spend: spend.toString() });
  else pass("tron native", { spend: spend.toString(), tokens: tokenN(app) });
  const desk = await readTronStake(addr).catch(() => []);
  const deskRaw = desk.reduce((s, l) => s + l.raw, 0n);
  if (frozen > 0n && deskRaw === 0n) fail("tron missing frozen stake", { frozen: frozen.toString() });
  else if (frozen > 0n) pass("tron stake", { frozen: frozen.toString(), desk: deskRaw.toString() });
  else pass("tron stake none");
}

async function checkAptos(addr: string) {
  const app = await fetchAptos(addr);
  const first = (await getJson(`https://api.mainnet.aptoslabs.com/v1/accounts/${addr}/fungible_asset_balances?limit=100`)) as
    | unknown[]
    | { data?: unknown[]; __status?: number }
    | null;
  const firstN = Array.isArray(first) ? first.length : Array.isArray(first && "data" in first ? first.data : null) ? (first as { data: unknown[] }).data.length : -1;
  if (firstN < 0) skip("aptos fa lcd");
  else {
    const appN = tokenN(app);
    pass("aptos fa", { first: firstN, app: appN, native: app.get("native")?.raw.toString() });
  }
}

async function checkSol(addr: string) {
  const app = await fetchSolana(addr);
  const alt = (await rpc("https://solana-rpc.publicnode.com", "getBalance", [addr])) as { value?: number } | null;
  if (alt && typeof alt.value === "number" && alt.value !== app.lamports) fail("sol native mismatch", { app: app.lamports, alt: alt.value });
  else pass("sol native", { lamports: app.lamports, mints: app.byMint.size });
  const desk = await readSolStake(addr).catch(() => []);
  pass("sol stake rows", { n: desk.length });
}

async function checkNear(addr: string) {
  const json = (await getJson("https://free.rpc.fastnear.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_account", finality: "final", account_id: addr } }),
  })) as { result?: { amount?: string } } | null;
  const amt = json?.result?.amount;
  if (!amt) skip("near view_account");
  else pass("near native", { amount: amt });
  const desk = await readNearStake(addr).catch(() => []);
  pass("near stake rows", { n: desk.length });
}

async function checkAda(addr: string) {
  const stake = addr.startsWith("stake") ? addr : "";
  if (!stake) {
    skip("ada need stake1...");
    return;
  }
  const utxos = (await koiosPost("account_utxos", { _stake_addresses: [stake], _extended: true }).catch(() => [])) as Array<{ value?: string }>;
  const info = (await koiosPost("account_info", { _stake_addresses: [stake] }).catch(() => [])) as Array<{ utxo?: string; total_balance?: string }>;
  let sum = 0n;
  for (const u of Array.isArray(utxos) ? utxos : []) {
    try {
      sum += BigInt(u.value || "0");
    } catch {
      /* skip */
    }
  }
  const listed = BigInt(info[0]?.utxo || info[0]?.total_balance || "0");
  if (sum > 0n && listed > 0n) {
    const ratio = Number(sum > listed ? sum : listed) / Number(sum < listed ? sum : listed);
    if (ratio > 1.05) fail("ada utxo vs account_info", { utxos: sum.toString(), info: listed.toString(), n: Array.isArray(utxos) ? utxos.length : 0 });
    else pass("ada utxos", { n: Array.isArray(utxos) ? utxos.length : 0, ada: Number(sum) / 1e6 });
  } else pass("ada", { n: Array.isArray(utxos) ? utxos.length : 0, sum: sum.toString() });
}

async function checkEvm(addr: string) {
  const a = addr.toLowerCase();
  const pn = (await rpc("https://ethereum-rpc.publicnode.com", "eth_getBalance", [a, "latest"])) as string | null;
  const cf = (await rpc("https://cloudflare-eth.com", "eth_getBalance", [a, "latest"])) as string | null;
  if (pn && cf && BigInt(pn) !== BigInt(cf)) fail("evm native rpc split", { publicnode: pn, cloudflare: cf });
  else if (pn) pass("evm native", { wei: BigInt(pn).toString() });
  else skip("evm rpc");
  const base = explorerUrl(1);
  if (!base) return;
  const json = await getJson(`${base}/api/v2/addresses/${a}/token-balances`);
  const n = Array.isArray(json) ? json.length : json && typeof json === "object" && Array.isArray((json as { items?: unknown[] }).items) ? (json as { items: unknown[] }).items.length : -1;
  if (n < 0) skip("evm explorer shape");
  else pass("evm explorer tokens", { n });
}

async function run(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    fail(name, { err: err instanceof Error ? err.message : String(err) });
  }
}

async function main() {
  const evm = arg("evm");
  const near = arg("near");
  const ada = arg("ada");
  const sol = arg("sol");
  const sui = arg("sui");
  const tron = arg("tron");
  const atom = arg("atom");
  const osmo = arg("osmo");
  const tia = arg("tia");
  const xrp = arg("xrp");
  const apt = arg("apt");

  await run("xrpl", () => checkXrpl(xrp || WHALES.xrpl, xrp ? "xrp" : "xrp whale"));
  if (atom) await run("atom", () => checkCosmos(118, atom, "atom"));
  else skip("atom no addr");
  await run("osmo", () => checkCosmos(100001, osmo || WHALES.osmosis, osmo ? "osmo" : "osmo whale"));
  if (tia) await run("tia", () => checkCosmos(100002, tia, "tia"));
  else skip("tia no addr");

  if (evm) await run("evm", () => checkEvm(evm));
  else skip("evm no addr");
  if (near) await run("near", () => checkNear(near));
  else skip("near no addr");
  if (ada) await run("ada", () => checkAda(ada));
  else skip("ada no addr");
  if (sol) await run("sol", () => checkSol(sol));
  else skip("sol no addr");
  if (sui) await run("sui", () => checkSui(sui));
  else skip("sui no addr");
  if (tron) await run("tron", () => checkTron(tron));
  else skip("tron no addr");
  if (apt) await run("apt", () => checkAptos(apt));
  else skip("apt no addr");

  console.log(`\n${fails ? "FAIL" : "PASS"}  fails=${fails} skips=${skips}`);
  if (fails) process.exit(1);
}

await main();

import { accountCache } from "../defi/cache.ts";
import { quoteSolMints } from "../defiQuotes.ts";
import { rpcJsonRpc } from "../rpcPool.ts";
import { decodeB58, findPda } from "../solanaPda.ts";
import i18n from "../i18n.ts";
import { fmtAmt, utc, type StakeLine } from "./shared.ts";

/** Solana Mobile SKR (SPL). Staked amount lives in a UserStake PDA, not the wallet ATA. */
export const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
const SKR_PROGRAM = "SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ";
const SKR_CONFIG = "4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw";
/** Solana Mobile guardian pool (the live public pool at launch). */
const SKR_POOL = "DPJ58trLsF9yPrBa2pk6UaRkvqW8hWUYjawe788WBuqr";
const SKR_DECIMALS = 6;
const SHARE_SCALE = 1_000_000_000n;
const USER_DISC = new Uint8Array([102, 53, 163, 107, 9, 138, 87, 153]);
const CFG_DISC = new Uint8Array([238, 151, 43, 3, 11, 151, 63, 176]);

type AccInfo = { value?: { data?: [string, string] } | null } | null;

function b64(data: string): Uint8Array {
  const bin = atob(data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function same(a: Uint8Array, b: Uint8Array) {
  if (a.length < b.length) return false;
  for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function u64(view: DataView, off: number) {
  return view.getBigUint64(off, true);
}

function u128(view: DataView, off: number) {
  return u64(view, off) + (u64(view, off + 8) << 64n);
}

function i64(view: DataView, off: number) {
  return view.getBigInt64(off, true);
}

async function accountBytes(pubkey: string): Promise<Uint8Array | null> {
  const info = await rpcJsonRpc<AccInfo>(101, "getAccountInfo", [pubkey, { encoding: "base64" }]);
  const raw = info?.value?.data?.[0];
  return raw ? b64(raw) : null;
}

async function userStakePda(user: string) {
  const cfg = decodeB58(SKR_CONFIG);
  const owner = decodeB58(user);
  const pool = decodeB58(SKR_POOL);
  if (!cfg || !owner || !pool) return null;
  return findPda(SKR_PROGRAM, [new TextEncoder().encode("user_stake"), cfg, owner, pool]);
}

function sharesToRaw(shares: bigint, sharePrice: bigint) {
  if (sharePrice <= 0n) return 0n;
  return (shares * sharePrice) / SHARE_SCALE;
}

export async function readSkrStake(pubkey: string): Promise<StakeLine[]> {
  if (!pubkey) return [];
  return accountCache("pos.stake", 101, pubkey, "skr", () => readSkrStakeWork(pubkey));
}

async function readSkrStakeWork(pubkey: string): Promise<StakeLine[]> {
  const pda = await userStakePda(pubkey);
  if (!pda) return [];
  let cfg: Uint8Array | null = null;
  let user: Uint8Array | null = null;
  try {
    cfg = await accountBytes(SKR_CONFIG);
    user = await accountBytes(pda);
  } catch {
    return [];
  }
  if (!cfg || cfg.length < 193 || !same(cfg, CFG_DISC)) return [];
  if (!user || user.length < 169 || !same(user, USER_DISC)) return [];

  const cfgView = new DataView(cfg.buffer, cfg.byteOffset, cfg.byteLength);
  const userView = new DataView(user.buffer, user.byteOffset, user.byteLength);
  const sharePrice = u128(cfgView, 137);
  const cooldown = Number(u64(cfgView, 113));
  const shares = u128(userView, 105);
  const unstakingRaw = u64(userView, 153);
  const unstakeTs = Number(i64(userView, 161));
  const stakedRaw = sharesToRaw(shares, sharePrice);
  if (stakedRaw <= 0n && unstakingRaw <= 0n) return [];

  let skrUsd: number | undefined;
  try {
    const q = await quoteSolMints([SKR_MINT]);
    skrUsd = q.get(SKR_MINT)?.usdc ?? q.get(SKR_MINT.toLowerCase())?.usdc;
  } catch {
    skrUsd = undefined;
  }

  const out: StakeLine[] = [];
  const quote = skrUsd && skrUsd > 0 ? { usdc: skrUsd, source: "jup" as const } : null;
  const line = (id: string, raw: bigint, status: StakeLine["status"], note: string): StakeLine => {
    const n = Number(raw) / 10 ** SKR_DECIMALS;
    return {
      id,
      chainId: 101,
      chain: "SOL",
      symbol: "SKR",
      name: i18n.t("stake.skr"),
      icon: "/tokens/skr.png",
      amount: fmtAmt(raw, SKR_DECIMALS),
      raw,
      contract: SKR_MINT,
      side: "stake",
      extra: i18n.t("stake.skrGuardian"),
      quote,
      valueUsdc: quote && Number.isFinite(n) ? n * quote.usdc : null,
      status,
      inWallet: false,
      unstakeNote: note,
    };
  };

  if (stakedRaw > 0n) {
    out.push(line(`skr-stk-${pubkey}`, stakedRaw, "active", i18n.t("stake.skrNote")));
  }
  if (unstakingRaw > 0n) {
    const readyAt = unstakeTs > 0 && cooldown > 0 ? unstakeTs + cooldown : 0;
    const ready = readyAt > 0 && Date.now() / 1000 >= readyAt;
    out.push(
      line(
        `skr-unstk-${pubkey}`,
        unstakingRaw,
        ready ? "claimable" : "unstaking",
        ready
          ? i18n.t("stake.skrClaim")
          : readyAt
            ? i18n.t("stake.skrUnstaking", { when: utc(readyAt) })
            : i18n.t("stake.skrNote"),
      ),
    );
  }
  return out;
}

import { getAddress, isAddress } from "viem";
import { isCardanoAddress, isNearAccountId, isSolanaAddress } from "@ysk-mint/sdk";

export type AddrKind =
  | "evm"
  | "near"
  | "cardano"
  | "solana"
  | "tron"
  | "sui"
  | "ton"
  | "aptos"
  | "bitcoin"
  | "xrpl"
  | "stellar"
  | "cosmos"
  | "osmosis"
  | "celestia"
  | "starknet";

export const ADDR_KINDS: AddrKind[] = [
  "evm",
  "near",
  "cardano",
  "solana",
  "tron",
  "sui",
  "ton",
  "aptos",
  "bitcoin",
  "xrpl",
  "stellar",
  "cosmos",
  "osmosis",
  "celestia",
  "starknet",
];

export const KIND_ICON: Record<AddrKind, string> = {
  evm: "/tokens/eth.png",
  near: "/tokens/near.png",
  cardano: "/tokens/ada.png",
  solana: "/tokens/sol.png",
  tron: "/tokens/trx.png",
  sui: "/tokens/sui.png",
  ton: "/tokens/ton.png",
  aptos: "/tokens/apt.png",
  bitcoin: "/tokens/btc.png",
  xrpl: "/tokens/xrp.png",
  stellar: "/tokens/xlm.png",
  cosmos: "/tokens/atom.png",
  osmosis: "/tokens/osmo.png",
  celestia: "/tokens/tia.png",
  starknet: "/tokens/strk.png",
};

const HEX64 = /^[0-9a-f]{64}$/;
const B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export type DetectHit =
  | { ok: true; kind: AddrKind; value: string; candidates?: undefined }
  | { ok: true; kind?: undefined; value: string; candidates: AddrKind[] }
  | { ok: false; error: "empty" | "invalid" };

export function normalizeAddr(kind: AddrKind, raw: string): string {
  const s = raw.trim();
  if (kind === "evm") {
    try {
      return getAddress(s);
    } catch {
      return s;
    }
  }
  if (kind === "near") return s.toLowerCase();
  if (kind === "sui" || kind === "aptos" || kind === "starknet") {
    const hex = s.replace(/^0x/i, "").toLowerCase();
    return `0x${hex}`;
  }
  return s;
}

export function addrKey(kind: AddrKind, value: string) {
  return `${kind}:${normalizeAddr(kind, value).toLowerCase()}`;
}

export function shortAddr(kind: AddrKind, value: string) {
  if (kind === "near" && value.length <= 32) return value;
  if (kind === "solana") return clip(value, 4, 4);
  if (kind === "cardano") return clip(value, 10, 6);
  if (kind === "evm") return clip(value, 6, 4);
  return clip(value, 8, 6);
}

function clip(s: string, head: number, tail: number) {
  if (!s || s.length <= head + tail + 1) return s || "—";
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function detectAddrKind(raw: string): DetectHit {
  const s = raw.trim();
  if (!s) return { ok: false, error: "empty" };

  if (/^(addr1|addr_test1|stake1|stake_test1)[0-9a-z]+$/.test(s) && isCardanoAddress(s)) {
    return { ok: true, kind: "cardano", value: s };
  }
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)) return { ok: true, kind: "tron", value: s };
  if (/^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/.test(s) || /^-?\d+:[0-9a-fA-F]{64}$/.test(s)) {
    return { ok: true, kind: "ton", value: s };
  }
  if (/^G[A-Z2-7]{55}$/.test(s)) return { ok: true, kind: "stellar", value: s };
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(s)) return { ok: true, kind: "xrpl", value: s };
  if (/^cosmos1[0-9a-z]{38,}$/.test(s)) return { ok: true, kind: "cosmos", value: s };
  if (/^osmo1[0-9a-z]{38,}$/.test(s)) return { ok: true, kind: "osmosis", value: s };
  if (/^celestia1[0-9a-z]{38,}$/.test(s)) return { ok: true, kind: "celestia", value: s };
  if (/^(bc1|tb1)[0-9a-z]{25,62}$/.test(s) || /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(s)) {
    return { ok: true, kind: "bitcoin", value: s };
  }

  if (s.startsWith("0x") || s.startsWith("0X")) {
    if (isAddress(s, { strict: false })) {
      try {
        return { ok: true, kind: "evm", value: getAddress(s) };
      } catch {
        return { ok: true, kind: "evm", value: s };
      }
    }
    const hex = s.slice(2);
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length >= 50) {
      const value = `0x${hex.toLowerCase()}`;
      return { ok: true, value, candidates: ["sui", "aptos", "starknet"] };
    }
    return { ok: false, error: "invalid" };
  }

  const near = s.toLowerCase();
  if (HEX64.test(near) || (/\.(near|tg|testnet|mainnet)$/.test(near) && isNearAccountId(near))) {
    return { ok: true, kind: "near", value: near };
  }
  if (isSolanaAddress(s) && B58.test(s)) return { ok: true, kind: "solana", value: s };

  return { ok: false, error: "invalid" };
}

export function confirmKind(raw: string, kind: AddrKind): DetectHit {
  const hit = detectAddrKind(raw);
  if (!hit.ok) return hit;
  if (hit.kind === kind) return hit;
  if (hit.candidates?.includes(kind)) return { ok: true, kind, value: normalizeAddr(kind, hit.value) };
  return { ok: false, error: "invalid" };
}

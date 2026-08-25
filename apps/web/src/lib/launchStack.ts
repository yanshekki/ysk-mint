import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { isConfigured, launchContracts, type ChainDefinition, type LaunchContracts } from "@ysk-mint/sdk";
import { LAUNCH_BYTECODE } from "./launchBytecode.ts";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const STORE = "ysk-mint.launch-stack";

const lockerAbi = [{ type: "constructor", stateMutability: "nonpayable", inputs: [] }] as const;
const managerAbi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [{ name: "locker_", type: "address" }],
  },
] as const;
const routerAbi = [{ type: "constructor", stateMutability: "nonpayable", inputs: [] }] as const;
const factoryAbi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [{ name: "endpoint_", type: "address" }],
  },
] as const;

function live(addr: `0x${string}` | undefined): addr is `0x${string}` {
  return Boolean(addr && addr !== ZERO);
}

function readStore(): Record<string, LaunchContracts> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}") as Record<string, LaunchContracts>;
  } catch {
    return {};
  }
}

export function localStack(chainId: number): LaunchContracts | undefined {
  return readStore()[String(chainId)];
}

export function saveLocalStack(chainId: number, stack: LaunchContracts) {
  const all = readStore();
  all[String(chainId)] = stack;
  localStorage.setItem(STORE, JSON.stringify(all));
}

export function resolvedContracts(chain: ChainDefinition): LaunchContracts | undefined {
  const cfg = launchContracts(chain.key);
  const local = localStack(chain.chainId);
  const merged: LaunchContracts = {
    factory: live(local?.factory) ? local.factory : (cfg?.factory ?? ZERO),
    manager: live(local?.manager) ? local.manager : (cfg?.manager ?? ZERO),
    locker: live(local?.locker) ? local.locker : (cfg?.locker ?? ZERO),
    v2Router: live(local?.v2Router) ? local.v2Router : (cfg?.v2Router ?? ZERO),
  };
  return merged;
}

export function canWalletDeploy(chain: ChainDefinition) {
  if (!chain.evm || !live(chain.endpoint)) return false;
  const cfg = launchContracts(chain.key);
  if (chain.testnet) return true;
  return live(cfg?.v2Router);
}

export function needsMockRouter(chain: ChainDefinition) {
  return chain.testnet && !live(resolvedContracts(chain)?.v2Router);
}

async function createdAddress(publicClient: PublicClient, hash: Hex): Promise<Address> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("missing contract address");
  return receipt.contractAddress;
}

export async function ensureStack(args: {
  chain: ChainDefinition;
  publicClient: PublicClient;
  wallet: WalletClient;
  account: Address;
}): Promise<LaunchContracts> {
  const current = resolvedContracts(args.chain);
  if (isConfigured(current)) {
    const code = await args.publicClient.getCode({ address: current.factory });
    if (code && code !== "0x") return current;
  }
  if (!canWalletDeploy(args.chain)) {
    throw new Error("stack undeployed");
  }

  const account = args.account;
  const viemChain = args.wallet.chain;
  const lockerHash = await args.wallet.deployContract({
    abi: lockerAbi,
    bytecode: LAUNCH_BYTECODE.liquidityLocker as Hex,
    account,
    chain: viemChain,
  });
  const locker = await createdAddress(args.publicClient, lockerHash);

  const managerHash = await args.wallet.deployContract({
    abi: managerAbi,
    bytecode: LAUNCH_BYTECODE.liquidityManager as Hex,
    args: [locker],
    account,
    chain: viemChain,
  });
  const manager = await createdAddress(args.publicClient, managerHash);

  let v2Router = live(current?.v2Router) ? current.v2Router : undefined;
  if (!v2Router) {
    const routerHash = await args.wallet.deployContract({
      abi: routerAbi,
      bytecode: LAUNCH_BYTECODE.mockV2Router as Hex,
      account,
      chain: viemChain,
    });
    v2Router = await createdAddress(args.publicClient, routerHash);
  }

  const factoryHash = await args.wallet.deployContract({
    abi: factoryAbi,
    bytecode: LAUNCH_BYTECODE.tokenFactory as Hex,
    args: [args.chain.endpoint],
    account,
    chain: viemChain,
  });
  const factory = await createdAddress(args.publicClient, factoryHash);

  const stack: LaunchContracts = { factory, manager, locker, v2Router };
  saveLocalStack(args.chain.chainId, stack);
  return stack;
}

import {
  CHAINS,
  issuanceChains,
  isConfigured,
  testnetChains,
  type ChainDefinition,
  type ChainVm,
} from "@ysk-mint/config";
import { canWalletDeploy, resolvedContracts } from "./launchStack.ts";

const ISSUANCE_VMS: ChainVm[] = ["evm", "cardano", "near", "solana", "sui", "aptos"];

export const ISSUANCE_GROUP_TITLE: Partial<Record<ChainVm, string>> = {
  evm: "wizard.chains.groupEvm",
  cardano: "wizard.chains.adaHint",
  near: "wizard.chains.nearHint",
  solana: "wizard.chains.solHint",
  sui: "wizard.chains.suiHint",
  aptos: "wizard.chains.aptHint",
};

export function issuanceGroups() {
  const main = issuanceChains().filter((c) => !c.testnet);
  const tests = testnetChains();
  return ISSUANCE_VMS.map((vm) => ({
    vm,
    main: main.filter((c) => c.vm === vm),
    test: tests.filter((c) => c.vm === vm),
  }));
}

export function chainDef(key: number): ChainDefinition | undefined {
  return CHAINS[key as keyof typeof CHAINS];
}

export function selectedChains(keys: number[]): ChainDefinition[] {
  return keys.map((k) => chainDef(k)).filter((c): c is ChainDefinition => Boolean(c));
}

export function selectedEvm(keys: number[]): ChainDefinition[] {
  return selectedChains(keys).filter((c) => c.evm);
}

export function configuredEvm(keys: number[]): ChainDefinition[] {
  return selectedEvm(keys).filter((c) => isConfigured(resolvedContracts(c)));
}

export function undeployedEvm(keys: number[]): ChainDefinition[] {
  return selectedEvm(keys).filter((c) => !isConfigured(resolvedContracts(c)));
}

export function deployableEvm(keys: number[]): ChainDefinition[] {
  return undeployedEvm(keys).filter((c) => canWalletDeploy(c));
}

export function blockedEvm(keys: number[]): ChainDefinition[] {
  return undeployedEvm(keys).filter((c) => !canWalletDeploy(c));
}

/** First selected EVM that is configured; else first selected EVM. */
export function homeEvm(keys: number[]): ChainDefinition | undefined {
  return configuredEvm(keys)[0] ?? selectedEvm(keys)[0];
}

export function chainByEvmId(chainId: number): ChainDefinition | undefined {
  return Object.values(CHAINS).find((c) => c.evm && c.chainId === chainId);
}

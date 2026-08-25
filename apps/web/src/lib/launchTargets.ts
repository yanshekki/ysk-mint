import { CHAINS, isConfigured, launchContracts, type ChainDefinition } from "@ysk-mint/config";

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
  return selectedEvm(keys).filter((c) => isConfigured(launchContracts(c.key)));
}

export function undeployedEvm(keys: number[]): ChainDefinition[] {
  return selectedEvm(keys).filter((c) => !isConfigured(launchContracts(c.key)));
}

/** First selected EVM that is configured; else first selected EVM. */
export function homeEvm(keys: number[]): ChainDefinition | undefined {
  return configuredEvm(keys)[0] ?? selectedEvm(keys)[0];
}

export function chainByEvmId(chainId: number): ChainDefinition | undefined {
  return Object.values(CHAINS).find((c) => c.evm && c.chainId === chainId);
}

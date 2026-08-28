import { makeGeckoProtocol, type GeckoDexSpec } from "../http/geckoDex.ts";

function apt(dex: string, protocolId: string, protocolName: string, feeLabel: string): GeckoDexSpec {
  return {
    network: "aptos",
    dex,
    chainId: 637,
    chainShort: "APT",
    protocolId,
    protocolName,
    feeLabel,
    pages: 1,
  };
}

export const aptosGeckoProtocols = [
  makeGeckoProtocol({
    id: "thala-637",
    name: "Thala",
    chainId: 637,
    specs: [
      apt("thalaswap-v2", "thala-637", "Thala", "V2"),
      apt("thalaswap-cl", "thala-637", "Thala", "CLMM"),
    ],
  }),
  makeGeckoProtocol({
    id: "tapp-637",
    name: "Tapp",
    chainId: 637,
    specs: [apt("tapp-exchange", "tapp-637", "Tapp", "AMM")],
  }),
  makeGeckoProtocol({
    id: "liquidswap-637",
    name: "Liquidswap",
    chainId: 637,
    specs: [apt("liquidswap-v0-5", "liquidswap-637", "Liquidswap", "V0.5")],
  }),
  makeGeckoProtocol({
    id: "pancake-637",
    name: "PancakeSwap",
    chainId: 637,
    specs: [apt("pancakeswap_aptos", "pancake-637", "PancakeSwap", "V2")],
  }),
];

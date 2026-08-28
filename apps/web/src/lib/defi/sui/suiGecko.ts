import { makeGeckoProtocol, type GeckoDexSpec } from "../http/geckoDex.ts";

function sui(dex: string, protocolId: string, protocolName: string, feeLabel: string): GeckoDexSpec {
  return {
    network: "sui-network",
    dex,
    chainId: 784,
    chainShort: "SUI",
    protocolId,
    protocolName,
    feeLabel,
    pages: 1,
  };
}

export const suiGeckoProtocols = [
  makeGeckoProtocol({
    id: "bluefin-784",
    name: "Bluefin",
    chainId: 784,
    specs: [sui("bluefin", "bluefin-784", "Bluefin", "CLMM")],
  }),
  makeGeckoProtocol({
    id: "turbos-784",
    name: "Turbos",
    chainId: 784,
    specs: [sui("turbos-finance", "turbos-784", "Turbos", "CLMM")],
  }),
  makeGeckoProtocol({
    id: "momentum-784",
    name: "Momentum",
    chainId: 784,
    specs: [sui("momentum", "momentum-784", "Momentum", "CLMM")],
  }),
  makeGeckoProtocol({
    id: "magma-784",
    name: "Magma",
    chainId: 784,
    specs: [sui("magma-finance", "magma-784", "Magma", "CLMM")],
  }),
  makeGeckoProtocol({
    id: "kriya-784",
    name: "Kriya",
    chainId: 784,
    specs: [sui("kriya-dex", "kriya-784", "Kriya", "CLMM")],
  }),
];

import { makeGeckoProtocol, type GeckoDexSpec } from "../http/geckoDex.ts";

function spec(
  network: string,
  dex: string,
  chainId: number,
  chainShort: string,
  protocolId: string,
  protocolName: string,
  feeLabel: string,
): GeckoDexSpec {
  return { network, dex, chainId, chainShort, protocolId, protocolName, feeLabel, pages: 1 };
}

export const geckoEvmProtocols = [
  makeGeckoProtocol({
    id: "swapx-146",
    name: "SwapX",
    chainId: 146,
    specs: [
      spec("sonic", "swapx-v2", 146, "S", "swapx-146", "SwapX", "V2"),
      spec("sonic", "swapx-algebra", 146, "S", "swapx-146", "SwapX", "Algebra"),
    ],
  }),
  makeGeckoProtocol({
    id: "equalizer-146",
    name: "Equalizer",
    chainId: 146,
    specs: [spec("sonic", "equalizer-sonic", 146, "S", "equalizer-146", "Equalizer", "V2")],
  }),
  makeGeckoProtocol({
    id: "wagmi-146",
    name: "Wagmi",
    chainId: 146,
    specs: [spec("sonic", "wagmi-sonic", 146, "S", "wagmi-146", "Wagmi", "V3")],
  }),
  makeGeckoProtocol({
    id: "kittenswap-999",
    name: "KittenSwap",
    chainId: 999,
    specs: [
      spec("hyperevm", "kittenswap", 999, "HyperEVM", "kittenswap-999", "KittenSwap", "V2"),
      spec("hyperevm", "kittenswap-v3", 999, "HyperEVM", "kittenswap-999", "KittenSwap", "V3"),
    ],
  }),
  makeGeckoProtocol({
    id: "projectx-999",
    name: "Project X",
    chainId: 999,
    specs: [spec("hyperevm", "project-x", 999, "HyperEVM", "projectx-999", "Project X", "CLMM")],
  }),
  makeGeckoProtocol({
    id: "hybra-999",
    name: "Hybra",
    chainId: 999,
    specs: [
      spec("hyperevm", "hybra-finance", 999, "HyperEVM", "hybra-999", "Hybra", "V2"),
      spec("hyperevm", "hybra-finance-v3", 999, "HyperEVM", "hybra-999", "Hybra", "V3"),
    ],
  }),
  makeGeckoProtocol({
    id: "bex-80094",
    name: "BEX",
    chainId: 80094,
    specs: [spec("berachain", "bex", 80094, "BERA", "bex-80094", "BEX", "AMM")],
  }),
  makeGeckoProtocol({
    id: "burrbear-80094",
    name: "BurrBear",
    chainId: 80094,
    specs: [spec("berachain", "burrbear", 80094, "BERA", "burrbear-80094", "BurrBear", "AMM")],
  }),
];

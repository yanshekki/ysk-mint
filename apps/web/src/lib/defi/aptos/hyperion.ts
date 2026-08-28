import { geckoDexMarkets } from "../http/geckoDex.ts";
import type { DefiProtocol } from "../types.ts";

export const hyperionProtocol: DefiProtocol = {
  id: "hyperion-637",
  name: "Hyperion",
  chainId: 637,
  caps: ["markets"],
  async markets() {
    return geckoDexMarkets({
      network: "aptos",
      dex: "hyperion",
      chainId: 637,
      chainShort: "APT",
      protocolId: "hyperion-637",
      protocolName: "Hyperion",
      feeLabel: "CLMM",
    });
  },
};

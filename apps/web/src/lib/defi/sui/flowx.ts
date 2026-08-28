import { geckoDexMarkets, mergeMarketRows } from "../http/geckoDex.ts";
import type { DefiProtocol } from "../types.ts";

export const flowxProtocol: DefiProtocol = {
  id: "flowx-784",
  name: "FlowX",
  chainId: 784,
  caps: ["markets"],
  async markets() {
    const v2 = await geckoDexMarkets({
      network: "sui-network",
      dex: "flow-x",
      chainId: 784,
      chainShort: "SUI",
      protocolId: "flowx-784",
      protocolName: "FlowX",
      feeLabel: "V2",
    }).catch(() => []);
    const clmm = await geckoDexMarkets({
      network: "sui-network",
      dex: "flowx-clmm",
      chainId: 784,
      chainShort: "SUI",
      protocolId: "flowx-784",
      protocolName: "FlowX",
      feeLabel: "CLMM",
    }).catch(() => []);
    return mergeMarketRows([v2, clmm]);
  },
};

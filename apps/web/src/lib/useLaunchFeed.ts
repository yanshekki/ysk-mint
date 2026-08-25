import { useEffect, useState } from "react";
import { parseAbiItem } from "viem";
import { usePublicClient } from "wagmi";
import { ChainKey, isConfigured, launchContracts } from "@ysk-mint/sdk";
import type { CardToken } from "../shared/ui/TokenCard.tsx";
import { CHAINS } from "@ysk-mint/config";

const launchEvent = parseAbiItem(
  "event Launch(address indexed token, address indexed deployer, bytes32 indexed salt, string name, string symbol, uint8 supplyMode)",
);

export function useLaunchFeed() {
  const client = usePublicClient();
  const contracts = launchContracts(ChainKey.BaseSepolia);
  const chainId = CHAINS[ChainKey.BaseSepolia].chainId;
  const [created, setCreated] = useState<CardToken[]>([]);

  useEffect(() => {
    if (!client || !isConfigured(contracts)) {
      setCreated([]);
      return;
    }
    void client
      .getLogs({
        address: contracts.factory,
        event: launchEvent,
        fromBlock: 0n,
        toBlock: "latest",
      })
      .then((logs) => {
        setCreated(
          logs
            .slice()
            .reverse()
            .map((l) => ({
              ticker: (l.args.symbol as string) || "TKN",
              name: (l.args.name as string) || "",
              age: "on-chain",
              href: `/token/${chainId}/${l.args.token}`,
            })),
        );
      })
      .catch(() => setCreated([]));
  }, [client, contracts, chainId]);

  return { created, pending: [] as CardToken[], live: [] as CardToken[] };
}

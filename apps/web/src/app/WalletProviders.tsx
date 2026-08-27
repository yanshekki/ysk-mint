import { useEffect, useRef, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount } from "wagmi";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { cacheDropAccountRam, cacheInvalidateAccount, cacheReady } from "../lib/defi/cache.ts";
import { wagmiConfig } from "../lib/wagmi.ts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const rkTheme = lightTheme({
  accentColor: "#3b82f6",
  accentColorForeground: "#ffffff",
  borderRadius: "medium",
});

function CacheAccountGate({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const prev = useRef(address);
  useEffect(() => {
    void cacheReady();
  }, []);
  useEffect(() => {
    const was = prev.current;
    if (was && was !== address) {
      cacheInvalidateAccount(was);
      cacheDropAccountRam();
    }
    if (!address && was) cacheDropAccountRam();
    prev.current = address;
  }, [address]);
  return children;
}

export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme}>
          <CacheAccountGate>{children}</CacheAccountGate>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

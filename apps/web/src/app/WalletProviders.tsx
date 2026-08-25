import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { privyAppId, privyWagmiConfig, wagmiConfig, appChains } from "../lib/wagmi.ts";

const queryClient = new QueryClient();

const rkTheme = lightTheme({
  accentColor: "#3b82f6",
  accentColorForeground: "#ffffff",
  borderRadius: "medium",
});

export function WalletProviders({ children }: { children: ReactNode }) {
  if (privyAppId) {
    return (
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ["google", "email", "wallet"],
          appearance: {
            theme: "light",
            accentColor: "#3b82f6",
            logo: undefined,
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
          supportedChains: [...appChains],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={privyWagmiConfig} reconnectOnMount={false}>
            {children}
          </PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    );
  }
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

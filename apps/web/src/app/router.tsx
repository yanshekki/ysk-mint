import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { Shell } from "./Shell.tsx";
import { LpPage } from "../features/lp/LpPage.tsx";
import { PREFIX_LOCALES } from "../lib/locale.ts";
import { HomeRedirect, ZhHkRedirect, ZhToCnRedirect } from "./LocaleLink.tsx";

function appChildren(): RouteObject[] {
  return [
    { index: true, element: <LpPage /> },
    { path: "hot", element: <HomeRedirect /> },
    { path: "board", element: <HomeRedirect /> },
    {
      path: "lend/:chainId/:token",
      lazy: async () => {
        const { LendAssetRedirect } = await import("../features/lend/LendAssetPage.tsx");
        return { Component: LendAssetRedirect };
      },
    },
    {
      path: "lend/:symbol",
      lazy: async () => {
        const { LendAssetPage } = await import("../features/lend/LendAssetPage.tsx");
        return { Component: LendAssetPage };
      },
    },
    {
      path: "lend",
      lazy: async () => {
        const { LendPage } = await import("../features/lend/LendPage.tsx");
        return { Component: LendPage };
      },
    },
    {
      path: "create",
      lazy: async () => {
        const { CreatePage } = await import("../features/wizard/CreatePage.tsx");
        return { Component: CreatePage };
      },
    },
    {
      path: "pair/:chainId/:tokenA/:tokenB",
      lazy: async () => {
        const { PairPage } = await import("../features/lp/PairPage.tsx");
        return { Component: PairPage };
      },
    },
    {
      path: "token/:chainId/:address",
      lazy: async () => {
        const { TokenPage } = await import("../features/token/TokenPage.tsx");
        return { Component: TokenPage };
      },
    },
    {
      path: "locks/:chainId/:lockId",
      lazy: async () => {
        const { LockPage } = await import("../features/locks/LockPage.tsx");
        return { Component: LockPage };
      },
    },
    {
      path: "transfer",
      lazy: async () => {
        const { TransferPage } = await import("../features/transfer/TransferPage.tsx");
        return { Component: TransferPage };
      },
    },
    {
      path: "me/:kind/:protocol",
      lazy: async () => {
        const { MePage } = await import("../features/me/MePage.tsx");
        return { Component: MePage };
      },
    },
    {
      path: "me",
      lazy: async () => {
        const { MePage } = await import("../features/me/MePage.tsx");
        return { Component: MePage };
      },
    },
    {
      path: "settings",
      lazy: async () => {
        const { SettingsPage } = await import("../features/settings/SettingsPage.tsx");
        return { Component: SettingsPage };
      },
    },
    {
      path: "about",
      lazy: async () => {
        const { AboutPage } = await import("../features/legal/AboutPage.tsx");
        return { Component: AboutPage };
      },
    },
    {
      path: "donate",
      lazy: async () => {
        const { DonatePage } = await import("../features/legal/DonatePage.tsx");
        return { Component: DonatePage };
      },
    },
    {
      path: "terms",
      lazy: async () => {
        const { TermsPage } = await import("../features/legal/LegalDoc.tsx");
        return { Component: TermsPage };
      },
    },
    {
      path: "disclaimer",
      lazy: async () => {
        const { DisclaimerPage } = await import("../features/legal/LegalDoc.tsx");
        return { Component: DisclaimerPage };
      },
    },
  ];
}

export const router = createBrowserRouter([
  { path: "/zh-HK", element: <ZhHkRedirect /> },
  { path: "/zh-HK/*", element: <ZhHkRedirect /> },
  { path: "/zh", element: <ZhToCnRedirect /> },
  { path: "/zh/*", element: <ZhToCnRedirect /> },
  { path: "/", element: <Shell />, children: appChildren() },
  ...PREFIX_LOCALES.map((lng) => ({
    path: `/${lng}`,
    element: <Shell />,
    children: appChildren(),
  })),
]);

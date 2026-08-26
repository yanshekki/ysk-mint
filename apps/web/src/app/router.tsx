import { Navigate, createBrowserRouter } from "react-router-dom";
import { Shell } from "./Shell.tsx";
import { LpPage } from "../features/lp/LpPage.tsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <LpPage /> },
      { path: "hot", element: <Navigate to="/" replace /> },
      { path: "board", element: <Navigate to="/" replace /> },
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
        path: "me",
        lazy: async () => {
          const { MePage } = await import("../features/me/MePage.tsx");
          return { Component: MePage };
        },
      },
    ],
  },
]);

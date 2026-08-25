import { Navigate, createBrowserRouter } from "react-router-dom";
import { Shell } from "./Shell.tsx";
import { LpPage } from "../features/lp/LpPage.tsx";
import { CreatePage } from "../features/wizard/CreatePage.tsx";
import { TokenPage } from "../features/token/TokenPage.tsx";
import { LockPage } from "../features/locks/LockPage.tsx";
import { TransferPage } from "../features/transfer/TransferPage.tsx";
import { MePage } from "../features/me/MePage.tsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <LpPage /> },
      { path: "hot", element: <Navigate to="/" replace /> },
      { path: "board", element: <Navigate to="/" replace /> },
      { path: "create", element: <CreatePage /> },
      { path: "token/:chainId/:address", element: <TokenPage /> },
      { path: "locks/:chainId/:lockId", element: <LockPage /> },
      { path: "transfer", element: <TransferPage /> },
      { path: "me", element: <MePage /> },
    ],
  },
]);

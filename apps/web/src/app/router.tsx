import { createBrowserRouter } from "react-router-dom";
import { Shell } from "./Shell.tsx";
import { TrenchesPage } from "../features/trenches/TrenchesPage.tsx";
import { HotPage } from "../features/hot/HotPage.tsx";
import { BoardPage } from "../features/board/BoardPage.tsx";
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
      { index: true, element: <TrenchesPage /> },
      { path: "hot", element: <HotPage /> },
      { path: "board", element: <BoardPage /> },
      { path: "create", element: <CreatePage /> },
      { path: "token/:chainId/:address", element: <TokenPage /> },
      { path: "locks/:chainId/:lockId", element: <LockPage /> },
      { path: "transfer", element: <TransferPage /> },
      { path: "me", element: <MePage /> },
    ],
  },
]);

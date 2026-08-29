import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./styles.css";
import { i18nReady } from "./lib/i18n.ts";
import { router } from "./app/router.tsx";
import { WalletProviders } from "./app/WalletProviders.tsx";

void i18nReady.then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <WalletProviders>
        <RouterProvider router={router} />
      </WalletProviders>
    </StrictMode>,
  );
});

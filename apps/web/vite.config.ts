import { defineConfig, type PreviewServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { appRelease } from "./scripts/app-version.mjs";

const release = appRelease();

/** Optional. Set at build time only — never commit a live measurement id. */
function analyticsTag() {
  return {
    name: "analytics-tag",
    transformIndexHtml(html: string) {
      const id = String(process.env.VITE_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID || "").trim();
      if (!/^G-[A-Z0-9]+$/i.test(id)) return html;
      const snippet = `    <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${id}');
    </script>`;
      return html.replace("</head>", `${snippet}\n  </head>`);
    },
  };
}

function servePrerendered() {
  const dist = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
  const handler = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: Buffer) => void }, next: () => void) => {
    const path = (req.url ?? "/").split("?")[0].replace(/\/+$/, "") || "";
    if (!path || path.includes(".") || path.includes("..")) {
      next();
      return;
    }
    const file = join(dist, path.replace(/^\//, ""), "index.html");
    if (!existsSync(file)) {
      next();
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.end(readFileSync(file));
  };
  const versionJson = (_req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }, next: () => void) => {
    const path = (_req.url ?? "/").split("?")[0];
    if (path !== "/version.json") {
      next();
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.end(JSON.stringify(release));
  };
  return {
    name: "serve-prerendered",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(versionJson);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(versionJson);
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(release.version),
    "import.meta.env.VITE_APP_BUILD": JSON.stringify(release.build),
  },
  plugins: [
    nodePolyfills({
      include: ["buffer", "process", "util", "stream", "events"],
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    react(),
    tailwindcss(),
    analyticsTag(),
    servePrerendered(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/koios": {
        target: "https://api.koios.rest",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/koios/, "/api/v1"),
      },
    },
  },
});

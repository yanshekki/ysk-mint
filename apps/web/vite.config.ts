import { defineConfig, type PreviewServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

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
    res.end(readFileSync(file));
  };
  return {
    name: "serve-prerendered",
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ["buffer", "process", "util", "stream", "events"],
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    react(),
    tailwindcss(),
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

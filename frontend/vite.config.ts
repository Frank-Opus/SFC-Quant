import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function trimTerminalPath(value: string, suffix: string): string {
  return value.slice(-suffix.length) === suffix ? value.slice(0, -suffix.length) : value;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiTarget = trimTrailingSlash(
    env.FRONTEND_API_URL || env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  );
  const wsTarget = trimTrailingSlash(
    env.FRONTEND_WS_URL || env.VITE_WS_URL || "ws://127.0.0.1:8000/ws",
  );
  const wsProxyTarget = trimTerminalPath(wsTarget, "/ws");

  const proxy = {
    "/api": {
      target: apiTarget,
      changeOrigin: true,
    },
    "/health": {
      target: apiTarget,
      changeOrigin: true,
    },
    "/ws": {
      target: wsProxyTarget,
      changeOrigin: true,
      ws: true,
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy,
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
      proxy,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.indexOf("node_modules") === -1) {
              return;
            }
            if (id.indexOf("@tremor/react") !== -1) {
              return "tremor-vendor";
            }
            if (id.indexOf("lightweight-charts") !== -1) {
              return "chart-vendor";
            }
            if (
              id.indexOf("react") !== -1 ||
              id.indexOf("framer-motion") !== -1 ||
              id.indexOf("lucide-react") !== -1
            ) {
              return "ui-vendor";
            }
          },
        },
      },
    },
  };
});

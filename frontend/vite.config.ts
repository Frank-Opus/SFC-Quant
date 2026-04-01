import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
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
});

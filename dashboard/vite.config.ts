import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/hook": "http://localhost:4900",
      "/agent": "http://localhost:4900",
      "/mcp": "http://localhost:4900",
      "/health": "http://localhost:4900",
      "/ws": {
        target: "ws://localhost:4900",
        ws: true,
      },
    },
  },
});

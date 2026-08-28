import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const PORT = process.env.PORT || "8787";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@server": path.resolve(__dirname, "server"),
    },
  },
  server: {
    // This is a purely local, single-user tool — no need for Vite's Host-header
    // allowlist, which otherwise 403s any request not addressed to exactly
    // localhost/127.0.0.1 (LAN IP, .local hostname, tunnel, etc. all get blocked
    // before they ever reach the Bun backend).
    allowedHosts: true,
    proxy: {
      "/api": `http://localhost:${PORT}`,
      "/films": `http://localhost:${PORT}`,
    },
  },
});

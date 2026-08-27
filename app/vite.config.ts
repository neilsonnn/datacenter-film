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
    proxy: {
      "/api": `http://localhost:${PORT}`,
      "/films": `http://localhost:${PORT}`,
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Same commit SHA is used by the server (VERCEL_GIT_COMMIT_SHA) so clients can detect new deploys.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || `dev-${Date.now()}`;

export default defineConfig({
  root: "web",
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  publicDir: "public",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2020",
    assetsDir: "static",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-dom/client", "react-router-dom"],
          motion: ["framer-motion"],
          query: ["@tanstack/react-query", "zustand"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});

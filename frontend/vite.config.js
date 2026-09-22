import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // injectManifest (not Pup Facts' generateSW) because Web Push
      // needs a custom "push"/"notificationclick" service worker
      // handler — generateSW bundles Workbox internally and doesn't
      // support adding custom event listeners without ejecting.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      manifestFilename: "manifest.json",
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
      },
      // Without this, `npm run dev` never registers the custom sw.js —
      // push would only ever be testable after a production build.
      devOptions: { enabled: true, type: "module" },
    }),
  ],
});

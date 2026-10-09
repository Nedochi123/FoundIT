import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
}

// The service worker (src/sw.js) calls skipWaiting + clients.claim, so a new deploy activates by itself in the
// background (with injectManifest the plugin does NOT add those for us) — but that alone doesn't refresh an
// already-open tab's in-memory JS/HTML. Reloading once on "controllerchange" picks up the new version
// without a manual refresh. Guarded against firing twice, and skipped on a visitor's very first load, where
// the same event only means the worker took control for the first time (nothing is out of date yet).
if ("serviceWorker" in navigator) {
  let reloaded = false;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

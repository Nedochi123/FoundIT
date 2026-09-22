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

// The service worker (vite-plugin-pwa, registerType: "autoUpdate") is
// configured to skipWaiting + clientsClaim, so a new deploy activates
// automatically in the background — but that alone doesn't refresh an
// already-open tab's in-memory JS/HTML. Reloading once on
// "controllerchange" picks up the new version without a manual refresh.
// Guarded against firing twice.
if ("serviceWorker" in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

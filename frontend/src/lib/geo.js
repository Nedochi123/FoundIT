// The phone's location, for FoundIT's security log. Students must turn it on (components/location/LocationGate.jsx).
// The app keeps the latest fix in memory and sends it in an X-Geo header with each request that changes something
// (see lib/api.js), so the owner's activity log shows where the phone was when a post, chat or return happened.
// Nothing is sent on its own except one "opened the app" check-in; there is no tracking in the background.

const FRESH_MS = 15 * 60 * 1000; // a fix older than this is not sent
let last = null; // { lat, lng, accuracy, at }

export const geoSupported = () => typeof navigator !== "undefined" && "geolocation" in navigator;

/** "granted", "prompt", "denied", or "unknown" when the browser can't say (some iPhones). */
export async function permissionState() {
  if (!geoSupported()) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}

/** Calls back when the student turns location on or off in their browser settings (where that is reported). */
export async function watchPermission(onChange) {
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    const handler = () => onChange(status.state);
    status.addEventListener("change", handler);
    return () => status.removeEventListener("change", handler);
  } catch {
    return () => {};
  }
}

/**
 * Asks the phone where it is (the first call shows the browser's own permission question).
 * Resolves { ok: true, fix } or { ok: false, reason: "denied" | "unavailable" | "timeout" | "unsupported" }.
 */
export function readPosition({ timeout = 15000, maximumAge = 60000 } = {}) {
  if (!geoSupported()) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        last = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: Date.now() };
        resolve({ ok: true, fix: last });
      },
      (err) => resolve({ ok: false, reason: err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: false, timeout, maximumAge }
    );
  });
}

/** The X-Geo header value for the latest fix ("lat,lng,accuracy"), or null if there is none or it is stale. */
export function geoHeaderValue() {
  if (!last || Date.now() - last.at > FRESH_MS) return null;
  return `${last.lat.toFixed(5)},${last.lng.toFixed(5)},${Math.round(last.accuracy || 0)}`;
}

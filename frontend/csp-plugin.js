// Puts a Content-Security-Policy into the built index.html: a list of the only places the page may load things from and run scripts
// from, so an injected script (from a bug, a bad dependency or a hostile link) could neither run nor send anything out.
//
// It is a <meta> tag, not a header, because the page has a few small inline scripts (the saved color, the Home Screen icon, the
// analytics start-up) and their SHA-256 hashes are only known when the page is built; the policy lets exactly those run. The
// parts a <meta> tag cannot carry (no framing, no plugins) are in vercel.json. Used for production builds only: the dev server
// needs inline scripts of its own.
import { createHash } from "node:crypto";

/** The `'sha256-...'` source for every inline script in a page (scripts loaded from a file, and JSON-LD data, need none). */
export function inlineScriptHashes(html) {
  const hashes = [];
  for (const m of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs) || /type\s*=\s*["']?application\/ld\+json/i.test(attrs) || !m[2].trim()) continue;
    // a browser reads a page with every line ending as "\n" (even in a file saved with Windows "\r\n"), and hashes THAT text
    hashes.push(`'sha256-${createHash("sha256").update(m[2].replace(/\r\n?/g, "\n")).digest("base64")}'`);
  }
  return [...new Set(hashes)];
}

// Google Analytics 4. The first four are Google's own list; the last two (Google's ad network and its main site) are where it sends
// the "Google signals" audience hits, which show up as blocked requests if they are left out.
const ANALYTICS = [
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://analytics.google.com",
  "https://*.analytics.google.com",
  "https://*.googletagmanager.com",
  "https://*.g.doubleclick.net",
  "https://www.google.com",
];
const SENTRY = ["https://*.ingest.sentry.io", "https://*.ingest.us.sentry.io", "https://*.ingest.de.sentry.io"];

/** The policy text. `apiOrigin` is the server the app talks to (it also serves the photos), e.g. "https://api.example.com". */
export function buildPolicy({ hashes = [], apiOrigin = null } = {}) {
  const api = apiOrigin ? [apiOrigin] : [];
  const policy = {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...hashes, "https://www.googletagmanager.com"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    "img-src": ["'self'", "data:", "blob:", ...api, "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.g.doubleclick.net", "https://www.google.com"],
    "connect-src": ["'self'", ...api, ...SENTRY, ...ANALYTICS],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(policy).map(([name, sources]) => `${name} ${sources.join(" ")}`).join("; ");
}

export function cspPlugin() {
  let apiOrigin = null;
  return {
    name: "foundit-content-security-policy",
    apply: "build",
    configResolved(config) {
      try {
        apiOrigin = new URL(config.env.VITE_API_BASE_URL).origin;
      } catch {
        apiOrigin = null; // not set: the app would only talk to itself
      }
    },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const content = buildPolicy({ hashes: inlineScriptHashes(html), apiOrigin });
        return [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content }, injectTo: "head-prepend" }];
      },
    },
  };
}

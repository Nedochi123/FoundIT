// The page's Content-Security-Policy: only the page's own inline scripts (by hash), its own files, analytics and the API may be
// used; nothing else can run or be sent out. See csp-plugin.js.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildPolicy, cspPlugin, inlineScriptHashes } from "../csp-plugin.js";

const hash = (text) => `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
const parts = (policy) => Object.fromEntries(policy.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));
const PAGE = `<head><script type="application/ld+json">{"a":1}</script><script>var a = 1;</script><script src="/x.js"></script><script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script><script></script></head>`;

test("only the page's own inline scripts are allowed to run, by hash", () => {
  assert.deepEqual(inlineScriptHashes(PAGE), [hash("var a = 1;")]); // not JSON-LD data, not file scripts, not an empty one
  assert.deepEqual(inlineScriptHashes("<script>x()</script><script>x()</script>"), [hash("x()")], "the same script is listed once");
  assert.deepEqual(inlineScriptHashes(""), []);
});

test("line endings do not change the hash (a browser reads every line ending as \\n)", () => {
  assert.deepEqual(inlineScriptHashes("<script>a();\r\nb();\r\n</script>"), [hash("a();\nb();\n")]);
  assert.deepEqual(inlineScriptHashes("<script>a();\rb();</script>"), [hash("a();\nb();")]);
  assert.deepEqual(inlineScriptHashes("<script>a();\r\nb();</script>"), inlineScriptHashes("<script>a();\nb();</script>"));
});

test("scripts can come only from the app, its inline hashes and Google Tag Manager; nothing evaluates strings", () => {
  const p = parts(buildPolicy({ hashes: [hash("x")], apiOrigin: "https://api.example.com" }));
  assert.deepEqual(p["script-src"], ["'self'", hash("x"), "https://www.googletagmanager.com"]);
  const all = Object.values(p).flat().join(" ");
  assert.ok(!all.includes("'unsafe-eval'"));
  assert.ok(!p["script-src"].join(" ").includes("unsafe-inline"));
  assert.ok(!/(^|\s)\*(\s|$)|http:|https:(\s|$)/.test(all), "no wildcard, no plain http, no 'any https site'");
});

test("the app may talk to itself, its server, error reporting and analytics, and show its server's photos", () => {
  const p = parts(buildPolicy({ apiOrigin: "https://api.example.com" }));
  assert.ok(p["connect-src"].includes("https://api.example.com"));
  assert.ok(p["img-src"].includes("https://api.example.com"), "found-item photos come from the server");
  assert.ok(p["connect-src"].includes("https://*.ingest.sentry.io"));
  assert.ok(p["connect-src"].includes("https://*.google-analytics.com"));
  assert.deepEqual(p["default-src"], ["'self'"]);
  assert.deepEqual(p["object-src"], ["'none'"]);
  assert.deepEqual(p["base-uri"], ["'self'"]);
  assert.deepEqual(p["form-action"], ["'self'"]);
  assert.ok(!("frame-ancestors" in p), "a <meta> policy cannot carry frame-ancestors (vercel.json does)");
  assert.ok(!buildPolicy({}).includes("undefined") && !buildPolicy({}).includes("null"));
});

test("the plugin puts the policy first in the page's head, in production builds only", () => {
  const plugin = cspPlugin();
  assert.equal(plugin.apply, "build");
  plugin.configResolved({ env: { VITE_API_BASE_URL: "https://foundit-backend.example.app/some/path" } });
  const tags = plugin.transformIndexHtml.handler(PAGE);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].tag, "meta");
  assert.equal(tags[0].injectTo, "head-prepend");
  assert.equal(tags[0].attrs["http-equiv"], "Content-Security-Policy");
  assert.ok(tags[0].attrs.content.includes(hash("var a = 1;")));
  assert.ok(tags[0].attrs.content.includes("https://foundit-backend.example.app"));
  assert.ok(!tags[0].attrs.content.includes("/some/path"), "only the address's origin is used");
  assert.equal(plugin.transformIndexHtml.order, "post", "after every other change to the page's scripts");
});

test("vercel.json adds what a <meta> policy cannot, and the headers that protect the page", async () => {
  const { readFileSync } = await import("node:fs");
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const all = config.headers.find((h) => h.source === "/(.*)");
  const get = (key) => all.headers.find((h) => h.key === key)?.value;
  assert.match(get("Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.match(get("Content-Security-Policy"), /object-src 'none'/);
  assert.equal(get("X-Frame-Options"), "DENY");
  assert.equal(get("X-Content-Type-Options"), "nosniff");
  assert.match(get("Strict-Transport-Security"), /max-age=\d{8}/);
  assert.match(get("Permissions-Policy"), /geolocation=\(self\)/); // the app asks for the phone's location on purpose
  assert.match(get("Permissions-Policy"), /microphone=\(\)/);
  assert.ok(config.rewrites.length > 0, "the sticker-scan address still opens the app");
});

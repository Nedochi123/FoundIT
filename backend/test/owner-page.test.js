// The owner's private page (owner-page/): served as a separate page, kept out of search engines and caches, and
// written so that text from students can never run as code.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-ownerpage-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_EMAILS = "owner-page@example.com";
delete process.env.MONITOR_EMAILS;
delete process.env.RESEND_API_KEY;

const db = require("../db");
const app = require("../src/app");
const { signAccessToken } = require("../src/utils/tokens");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const pageDir = path.join(__dirname, "..", "owner-page");

test("the page is served at /owner, away from search engines and caches", async () => {
  const res = await fetch(base + "/owner/");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.match(res.headers.get("x-robots-tag"), /noindex/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const html = await res.text();
  assert.match(html, /name="robots" content="noindex/);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), "no inline script (the server's content policy would block it anyway)");
  assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);

  for (const file of ["owner.js", "owner.css"]) {
    const asset = await fetch(`${base}/owner/${file}`);
    assert.equal(asset.status, 200, file);
    assert.equal(asset.headers.get("cache-control"), "no-store", file);
  }
  assert.equal((await fetch(base + "/owner/nothing.html")).status, 404);
});

test("the private data the page reads is never cached", async () => {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, name, email, password_hash, email_verified_at) VALUES (?, 'Owner', 'owner-page@example.com', 'x', datetime('now'))").run(id);
  const token = signAccessToken({ id, email: "owner-page@example.com", name: "Owner" });
  const res = await fetch(base + "/api/monitor/activity", { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("the page's script can't turn student text into code", () => {
  const js = fs.readFileSync(path.join(pageDir, "owner.js"), "utf8");
  const code = js.replace(/\/\/.*$/gm, ""); // comments aren't code
  for (const banned of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function", "setTimeout(\"", "javascript:"]) {
    assert.ok(!code.includes(banned), `owner.js must not use ${banned}`);
  }
  assert.ok(!/https?:\/\/(?!www\.google\.com\/maps)/.test(code), "the page only talks to this server (plus the map links)");
  assert.ok(code.includes('credentials: "omit"'), "it keeps itself apart from the app's cookies");
});

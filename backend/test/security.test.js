// Security: other websites cannot make a signed-in browser change things, sign-in resists guessing, errors show no internals,
// cash-outs cannot overdraw tokens or carry odd bank details, uploads must really be images, and wrong-typed input is a 400.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

const work = fs.mkdtempSync(path.join(os.tmpdir(), "foundit-sec-"));
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(work, "test.db");
process.env.UPLOAD_ROOT = path.join(work, "uploads");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ALLOWED_ORIGINS = "https://app.example";
process.env.ADMIN_EMAILS = "owner-sec@example.com";
delete process.env.MONITOR_EMAILS;
delete process.env.RESEND_API_KEY;

const jwt = require("jsonwebtoken");
const db = require("../db");
const app = require("../src/app");
const { signAccessToken, verifyAccessToken } = require("../src/utils/tokens");
const { hashPassword, isAcceptablePassword, MAX_PASSWORD_BYTES } = require("../src/utils/password");
const { createThrottle } = require("../src/utils/loginThrottle");
const { looksLikeImage } = require("../src/utils/imageCheck");
const { originGuard } = require("../src/middleware/originGuard");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const uid = () => crypto.randomUUID();
async function makeUser(name, { email, password = "a good password", tokens = 0, verified = false } = {}) {
  const id = uid();
  email = email || `${name.toLowerCase().replace(/\W/g, "")}-${id.slice(0, 6)}@example.com`;
  db.prepare("INSERT INTO users (id, name, email, password_hash, tokens, email_verified_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, name, email, await hashPassword(password), tokens, verified ? "2026-10-01 08:00:00" : null);
  return { id, name, email, password, token: signAccessToken({ id, email, name }) };
}
const call = async (user, method, url, body, headers = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => ({})) };
};

// ---------------------------------------------------------------------------------------------- other websites
test("a request that names another site is refused for every kind of change, and a known site or our own page is not", async () => {
  const owner = await makeUser("Owner", { email: "owner-sec@example.com", verified: true });
  const evil = { Origin: "https://evil.example" };
  for (const [method, url] of [
    ["POST", "/api/boosts/admin/none/approve"], // an admin action that needs no body
    ["POST", "/api/auth/logout-all"],
    ["POST", "/api/conversations/none/reward/received"],
    ["PATCH", "/api/found-items/none/resolve"],
    ["DELETE", "/api/anything"],
    ["PUT", "/api/boosts/admin/settings"],
  ]) {
    const r = await call(owner, method, url, undefined, evil);
    assert.equal(r.status, 403, `${method} ${url} from another site`);
    assert.match(r.body.error, /another site/);
  }
  assert.equal((await call(owner, "POST", "/api/boosts/admin/none/approve", undefined, { Origin: "null" })).status, 403); // a sandboxed page
  assert.equal((await call(owner, "POST", "/api/boosts/admin/none/approve", undefined, { "Sec-Fetch-Site": "cross-site" })).status, 403);
  // our own app, our own address (the owner page), and a request that names no site (the phone app, curl) get through to the real route
  assert.equal((await call(owner, "POST", "/api/boosts/admin/none/approve", undefined, { Origin: "https://app.example" })).status, 404);
  assert.equal((await call(owner, "POST", "/api/boosts/admin/none/approve", undefined, { Origin: base })).status, 404);
  assert.equal((await call(owner, "POST", "/api/boosts/admin/none/approve")).status, 404);
  // reading is not a change: it is up to CORS (which answers other sites nothing)
  const read = await call(owner, "GET", "/api/health", undefined, evil);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("access-control-allow-origin"), null);
});

test("the guard, on its own", () => {
  const guard = originGuard(["https://a.example", "https://b.example"]);
  const run = (method, headers) => {
    let result = "next";
    const req = { method, get: (n) => headers[n.toLowerCase()] };
    const res = { status: (c) => ({ json: () => (result = c) }) };
    guard(req, res, () => {});
    return result;
  };
  assert.equal(run("POST", { origin: "https://b.example" }), "next");
  assert.equal(run("POST", { origin: "https://c.example" }), 403);
  assert.equal(run("POST", { origin: "https://a.example.evil.example" }), 403);
  assert.equal(run("POST", { origin: "https://internal", host: "internal" }), "next");
  assert.equal(run("POST", { origin: "not a url" }), 403);
  assert.equal(run("POST", {}), "next");
  assert.equal(run("GET", { origin: "https://evil.example" }), "next");
  assert.equal(run("OPTIONS", { origin: "https://evil.example" }), "next");
});

// ---------------------------------------------------------------------------------------------- what errors show
test("a server error never shows its details", async () => {
  // `db` is a switch to the request's school's database (db/index.js): break the real one, the default school's
  const handle = db.schoolDb();
  handle.prepare = () => {
    throw new Error("SQLITE_ERROR at /data/secret-place/dev.db no such table users");
  };
  let r;
  try {
    // a public page that reads the database (the gallery now needs a sign-in, and that check also reads it)
    r = await call(null, "GET", "/api/tags/public/ABCD1234");
  } finally {
    delete handle.prepare;
  }
  assert.equal(r.status, 500);
  assert.ok(!/SQLITE|secret-place|dev\.db|no such table/.test(JSON.stringify(r.body)), JSON.stringify(r.body));
  assert.match(r.body.error, /something went wrong/i);
});

test("a bad request still says what was wrong, and API answers are never cached", async () => {
  const r = await call(null, "POST", "/api/auth/login", "{not json");
  assert.equal(r.status, 400);
  assert.ok(r.body.error);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal((await call(null, "GET", "/api/health")).headers.get("cache-control"), "no-store");
});

// ---------------------------------------------------------------------------------------------- signing in
test("sign-in takes only text, and refresh/logout/verify/reset do not crash on other types", async () => {
  for (const body of [{ email: { $ne: "" }, password: "x" }, { email: "a@b.co", password: ["x"] }]) assert.equal((await call(null, "POST", "/api/auth/login", body)).status, 400);
  assert.equal((await call(null, "POST", "/api/auth/refresh", { refreshToken: { a: 1 } })).status, 401);
  assert.equal((await call(null, "POST", "/api/auth/logout", { refreshToken: ["x"] })).status, 200);
  assert.equal((await call(null, "POST", "/api/auth/verify-email", { token: { a: 1 } })).status, 400);
  for (const body of [{ token: ["x"], password: "long enough password" }, { token: "x", password: { a: 1 } }]) assert.equal((await call(null, "POST", "/api/auth/reset-password", body)).status, 400);
});

test("repeated wrong guesses lock one account, and another account carries on", async () => {
  const target = await makeUser("Target", { password: "the real password" });
  const other = await makeUser("Other", { password: "another password" });
  const wrong = [];
  for (let i = 0; i < 10; i++) wrong.push(await call(null, "POST", "/api/auth/login", { email: target.email, password: `wrong guess ${i}` }));
  assert.ok(wrong.every((r) => r.status === 401 && r.body.error === "Invalid email or password."));
  const unknown = await call(null, "POST", "/api/auth/login", { email: "nobody-here@example.com", password: "whatever" });
  assert.equal(unknown.status, 401);
  assert.deepEqual(unknown.body, wrong[0].body, "an unknown email must look exactly like a wrong password");
  const locked = await call(null, "POST", "/api/auth/login", { email: target.email, password: target.password }); // even the right one
  assert.equal(locked.status, 429);
  assert.match(locked.body.error, /15 minutes/);
  assert.equal((await call(null, "POST", "/api/auth/login", { email: other.email, password: other.password })).status, 200);
});

test("the lock counts per account, expires, and clears on success", () => {
  const t = createThrottle({ max: 3, windowMs: 1000 });
  for (let i = 0; i < 2; i++) t.recordFail("a@x.co", 0);
  assert.equal(t.isLocked("a@x.co", 10), false);
  t.recordFail("a@x.co", 20);
  assert.equal(t.isLocked("a@x.co", 30), true);
  assert.equal(t.isLocked("b@x.co", 30), false);
  assert.equal(t.isLocked("a@x.co", 5000), false, "the lock runs out");
  t.recordFail("c@x.co", 0);
  t.recordFail("c@x.co", 0);
  t.clear("c@x.co");
  t.recordFail("c@x.co", 0);
  assert.equal(t.isLocked("c@x.co", 1), false, "a good sign-in clears the count");
});

test("passwords: text, at least 8, and no more than bcrypt reads", () => {
  assert.equal(isAcceptablePassword("12345678"), true);
  assert.equal(isAcceptablePassword("1234567"), false);
  assert.equal(isAcceptablePassword("a".repeat(MAX_PASSWORD_BYTES)), true);
  assert.equal(isAcceptablePassword("a".repeat(MAX_PASSWORD_BYTES + 1)), false);
  assert.equal(isAcceptablePassword("é".repeat(37)), false, "74 bytes");
  for (const bad of [undefined, null, 12345678, ["12345678"], {}]) assert.equal(isAcceptablePassword(bad), false);
});

test("an access token must use the algorithm we sign with", () => {
  const payload = { sub: "u1", email: "a@b.co", name: "A" };
  assert.equal(verifyAccessToken(signAccessToken({ id: "u1", email: "a@b.co", name: "A" })).sub, "u1");
  assert.throws(() => verifyAccessToken(jwt.sign(payload, "test-access-secret", { algorithm: "HS512" })));
  assert.throws(() => verifyAccessToken(jwt.sign(payload, "another-secret", { algorithm: "HS256" })));
  assert.throws(() => verifyAccessToken(jwt.sign(payload, "", { algorithm: "none" })));
});

// ---------------------------------------------------------------------------------------------- cash-outs
test("a cash-out has real bank details, and tokens can never be spent twice", async () => {
  const student = await makeUser("Cashier", { tokens: 60 });
  const ok = { tier: 50, bankName: "Access Bank", accountNumber: "0123 456 789", accountName: "A Student" };
  for (const bad of [{ accountNumber: "12ab" }, { accountNumber: "1".repeat(21) }, { accountNumber: "<script>" }, { bankName: "B".repeat(61) }, { accountName: "N".repeat(81) }, { accountNumber: { a: 1 } }]) {
    assert.equal((await call(student, "POST", "/api/tokens/cashout", { ...ok, ...bad })).status, 400, JSON.stringify(bad));
  }
  assert.equal(db.prepare("SELECT tokens FROM users WHERE id = ?").get(student.id).tokens, 60, "nothing was taken for a refused request");
  const first = await call(student, "POST", "/api/tokens/cashout", ok);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const stored = db.prepare("SELECT account_number FROM cashout_requests WHERE user_id = ?").get(student.id);
  assert.equal(stored.account_number, "0123456789", "spaces in the number are removed");
  const second = await call(student, "POST", "/api/tokens/cashout", ok); // only 10 left
  assert.equal(second.status, 400);
  assert.equal(db.prepare("SELECT tokens FROM users WHERE id = ?").get(student.id).tokens, 10);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM cashout_requests WHERE user_id = ?").get(student.id).n, 1);
});

// ---------------------------------------------------------------------------------------------- uploads
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const upload = async (user, bytes, type = "image/png") => {
  const form = new FormData();
  form.append("photo", new Blob([bytes], { type }), "found.png");
  form.append("description", "Blue umbrella");
  const res = await fetch(base + "/api/found-items", { method: "POST", headers: { Authorization: `Bearer ${user.token}` }, body: form });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const keptFiles = () => (fs.existsSync(path.join(process.env.UPLOAD_ROOT, "found-items")) ? fs.readdirSync(path.join(process.env.UPLOAD_ROOT, "found-items")) : []);

test("an upload must really be an image, and a refused one is not kept on disk", async () => {
  const finder = await makeUser("Finder");
  const html = await upload(finder, Buffer.from("<html><script>alert(1)</script></html>")); // claims to be a PNG
  assert.equal(html.status, 400);
  assert.match(html.body.error, /photo/i);
  const gif = await upload(finder, Buffer.from("GIF89a....."), "image/gif"); // an unlisted type
  assert.equal(gif.status, 400);
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(keptFiles(), [], "nothing from the refused uploads is left");
  const real = await upload(finder, PNG);
  assert.equal(real.status, 201, JSON.stringify(real.body));
  assert.equal(keptFiles().length, 1);
});

test("the image check reads the first bytes", () => {
  assert.equal(looksLikeImage("image/png", PNG), true);
  assert.equal(looksLikeImage("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])), true);
  assert.equal(looksLikeImage("image/webp", Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1")), true);
  assert.equal(looksLikeImage("image/png", Buffer.from("<html>")), false);
  assert.equal(looksLikeImage("image/jpeg", PNG), false, "a PNG that says it is a JPEG");
  assert.equal(looksLikeImage("image/svg+xml", Buffer.from("<svg>")), false);
  assert.equal(looksLikeImage("image/png", Buffer.alloc(0)), false);
});

test("a message about an item needs the item's id as text", async () => {
  const student = await makeUser("Asker");
  for (const foundItemId of [{ a: 1 }, ["x"], 5, "", "x".repeat(65)]) assert.equal((await call(student, "POST", "/api/conversations", { foundItemId })).status, 400, JSON.stringify(foundItemId));
});

test("the server never builds a database command out of what a visitor sent", () => {
  const dir = path.join(__dirname, "..", "src", "routes");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".js"))) {
    const code = fs.readFileSync(path.join(dir, f), "utf8");
    // a value placed straight into SQL text (a column or table name that is ours is fine: those are constants, not `req`/`body`)
    assert.ok(!/prepare\(\s*`[^`]*\$\{\s*(req|body|query|params|parsed)/.test(code), `${f} puts request data into SQL`);
  }
});

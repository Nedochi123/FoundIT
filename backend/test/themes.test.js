// The look a student picks at sign-up (an app color and a style of floating doodles) is saved on their
// account, comes back on login, can be changed later, and only accepts the listed choices.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(fs.mkdtempSync(path.join(os.tmpdir(), "foundit-themes-")), "test.db");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
delete process.env.RESEND_API_KEY;

const db = require("../db");
const app = require("../src/app");
const { THEMES, DOODLES } = require("../src/utils/themes");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = async (url, body, token, method = "POST") => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const get = async (url, token) => {
  const res = await fetch(base + url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const signup = (extra = {}) =>
  post("/api/auth/signup", {
    name: "Ada Lovelace",
    email: `ada-${crypto.randomUUID().slice(0, 8)}@nileuniversity.edu.ng`,
    password: "password123",
    ...extra,
  });

test("the choices are the ones the app offers", () => {
  assert.ok(THEMES.includes("classic") && THEMES.includes("pink") && THEMES.includes("camo"));
  assert.ok(DOODLES.includes("none") && DOODLES.includes("kittens") && DOODLES.includes("aliens"));
  assert.equal(new Set(THEMES).size, THEMES.length);
  assert.equal(new Set(DOODLES).size, DOODLES.length);
});

test("signing up without choosing keeps the default look", async () => {
  const res = await signup();
  assert.equal(res.status, 201);
  assert.equal(res.body.user.theme, "classic");
  assert.equal(res.body.user.doodle, "none");
});

test("a chosen color and doodle style are saved and come back on login and /me", async () => {
  const email = `pink-${crypto.randomUUID().slice(0, 8)}@nileuniversity.edu.ng`;
  const res = await signup({ email, theme: "pink", doodle: "kittens" });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.theme, "pink");
  assert.equal(res.body.user.doodle, "kittens");
  const row = db.prepare("SELECT theme, doodle FROM users WHERE email = ?").get(email);
  assert.deepEqual({ ...row }, { theme: "pink", doodle: "kittens" });

  const login = await post("/api/auth/login", { email, password: "password123" });
  assert.equal(login.body.user.theme, "pink");
  assert.equal(login.body.user.doodle, "kittens");
  const me = await get("/api/auth/me", login.body.accessToken);
  assert.equal(me.body.user.theme, "pink");
});

test("anything that isn't a listed choice is refused, and nothing is saved", async () => {
  const email = `bad-${crypto.randomUUID().slice(0, 8)}@nileuniversity.edu.ng`;
  for (const extra of [{ theme: "hotpink" }, { doodle: "unicorns" }, { theme: "" }, { theme: 3 }, { theme: "pink; DROP TABLE users" }]) {
    const res = await signup({ email, ...extra });
    assert.equal(res.status, 400, JSON.stringify(extra));
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE email = ?").get(email).n, 0);
});

test("a student can change their look later, and can go back to the default", async () => {
  const { body } = await signup({ theme: "blue", doodle: "science" });
  const token = body.accessToken;

  const changed = await post("/api/users/me", { theme: "camo", doodle: "dogs" }, token, "PATCH");
  assert.equal(changed.status, 200);
  assert.equal(changed.body.user.theme, "camo");
  assert.equal(changed.body.user.doodle, "dogs");
  assert.equal(changed.body.user.name, "Ada Lovelace", "the rest of the profile is untouched");
  assert.equal(typeof changed.body.user.tokens, "number", "the reply is the full user, so the app's token count isn't lost");

  const justDoodle = await post("/api/users/me", { doodle: "money" }, token, "PATCH");
  assert.equal(justDoodle.body.user.theme, "camo", "changing one leaves the other");
  assert.equal(justDoodle.body.user.doodle, "money");

  const back = await post("/api/users/me", { theme: "classic", doodle: "none" }, token, "PATCH");
  assert.equal(back.body.user.theme, "classic");
  assert.equal(back.body.user.doodle, "none");

  assert.equal((await post("/api/users/me", { theme: "neon" }, token, "PATCH")).status, 400);
  assert.equal((await post("/api/users/me", { doodle: "<script>" }, token, "PATCH")).status, 400);
  assert.equal((await post("/api/users/me", {}, token, "PATCH")).status, 400, "nothing to update");
  assert.equal((await get("/api/auth/me", token)).body.user.theme, "classic", "bad requests changed nothing");
});

test("a stored value that is no longer offered falls back to the default instead of breaking the app", async () => {
  const { body } = await signup({ theme: "pink" });
  db.prepare("UPDATE users SET theme = 'retired-theme', doodle = 'retired-doodle' WHERE id = ?").run(body.user.id);
  const me = await get("/api/auth/me", body.accessToken);
  assert.equal(me.body.user.theme, "classic");
  assert.equal(me.body.user.doodle, "none");
});

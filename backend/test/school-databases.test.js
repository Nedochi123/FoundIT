// Each school has its OWN database (db/index.js). These tests prove the schools never mix: who can join, where their
// accounts, items, photos, chats and logs are written, which sessions work where, and that the daily jobs reach every
// school. They also prove the default school (Nile) works exactly as before, including for phones that send no school.
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { once } = require("events");
const jwt = require("jsonwebtoken");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "foundit-schools-"));
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:" + path.join(dir, "test.db");
process.env.UPLOAD_ROOT = path.join(dir, "uploads");
process.env.JWT_ACCESS_SECRET = "test-access-secret-test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-test-refresh-secret";
delete process.env.RESEND_API_KEY;
delete process.env.ALLOWED_EMAIL_DOMAIN;

// For these tests Baze is open (on the live server it is not yet); Veritas stays closed.
const schools = require("../src/config/schools");
schools.SCHOOLS.find((s) => s.id === "baze").enabled = true;

const db = require("../db");
const app = require("../src/app");
const { runBackup, backupDir } = require("../src/utils/backup");
const { expireStaleItems } = require("../src/utils/expireItems");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function call(method, url, { school, token, body, form } = {}) {
  const headers = {};
  if (school !== undefined) headers["X-School"] = school;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(base + url, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const uid = () => crypto.randomUUID().slice(0, 8);
const signup = (school, email, extra = {}) =>
  call("POST", "/api/auth/signup", { school, body: { name: "Test Student", email, password: "password123", ...extra } });
const userIn = (schoolId, email) => db.runWithSchool(schoolId, () => db.prepare("SELECT id, email FROM users WHERE email = ?").get(email));
const countIn = (schoolId, sql, ...args) => db.runWithSchool(schoolId, () => db.prepare(sql).get(...args).n);

test("every school has its own database file, made at start-up beside the main one (which stays where it was)", () => {
  assert.equal(db.schoolDbPath("nile"), path.join(dir, "test.db"), "the default school keeps the original file");
  for (const s of schools.SCHOOLS) {
    const file = db.schoolDbPath(s.id);
    assert.ok(fs.existsSync(file), `${s.name}: ${file}`);
    if (s.id !== "nile") assert.equal(file, path.join(dir, `test-${s.id}.db`));
    // same tables everywhere
    const tables = db.runWithSchool(s.id, () => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name));
    assert.ok(tables.includes("users") && tables.includes("found_items") && tables.includes("activity_log"), s.id);
  }
  assert.equal(new Set(schools.SCHOOLS.map((s) => db.schoolDbPath(s.id))).size, schools.SCHOOLS.length, "five different files");
  assert.notEqual(db.schoolDb("nile"), db.schoolDb("baze"));
});

test("a request that names no school is the default school's, so phones with an older copy of the app keep working", async () => {
  const email = `n-${uid()}@nileuniversity.edu.ng`;
  const r = await signup(undefined, email);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.ok(userIn("nile", email));
  assert.equal(userIn("baze", email), undefined);
  assert.equal(db.currentSchoolId(), "nile", "outside a request, code runs for the default school");
});

test("a school that is not open yet, or does not exist, cannot be reached at all", async () => {
  const closed = await call("POST", "/api/auth/signup", { school: "veritas", body: { name: "V", email: `v-${uid()}@veritas.edu.ng`, password: "password123" } });
  assert.equal(closed.status, 403);
  assert.match(closed.body.error, /Veritas University isn't open on FoundIT yet/);
  assert.equal(countIn("veritas", "SELECT COUNT(*) AS n FROM users"), 0, "nothing was written to the closed school");
  assert.equal((await call("GET", "/api/health", { school: "hogwarts" })).status, 400);
  assert.equal((await call("GET", "/api/health", { school: "../nile" })).status, 400);
  assert.equal((await call("GET", "/api/health", { school: "BAZE" })).status, 200, "capital letters do not matter");
});

test("a student joins only their own school, with that school's email, and is stored only in that school's database", async () => {
  const bazeEmail = `b-${uid()}@bazeuniversity.edu.ng`;
  const ok = await signup("baze", bazeEmail);
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.ok(userIn("baze", bazeEmail));
  assert.equal(userIn("nile", bazeEmail), undefined);

  const wrongAtBaze = await signup("baze", `n-${uid()}@nileuniversity.edu.ng`);
  assert.equal(wrongAtBaze.status, 400);
  assert.match(wrongAtBaze.body.error, /@bazeuniversity\.edu\.ng/);
  const wrongAtNile = await signup("nile", `b-${uid()}@bazeuniversity.edu.ng`);
  assert.equal(wrongAtNile.status, 400);
  assert.match(wrongAtNile.body.error, /@nileuniversity\.edu\.ng/);

  // the same address can exist at two schools only as two separate accounts; signing in looks only at that school
  const login = await call("POST", "/api/auth/login", { school: "nile", body: { email: bazeEmail, password: "password123" } });
  assert.equal(login.status, 401, "a Baze account cannot sign in at Nile");
});

test("ID numbers follow the school's format", async () => {
  const nileBad = await signup("nile", `n-${uid()}@nileuniversity.edu.ng`, { idNumber: "BU/22/CSC/001" });
  assert.equal(nileBad.status, 400);
  assert.match(nileBad.body.error, /9 digits/);
  const bazeOk = await signup("baze", `b-${uid()}@bazeuniversity.edu.ng`, { idNumber: "20231" });
  assert.equal(bazeOk.status, 201, JSON.stringify(bazeOk.body));
  const bazeLetters = await signup("baze", `b-${uid()}@bazeuniversity.edu.ng`, { idNumber: "BU/22/CSC/001" });
  assert.equal(bazeLetters.status, 400);
  assert.match(bazeLetters.body.error, /Baze ID number must be digits only/);
  const bazeBad = await signup("baze", `b-${uid()}@bazeuniversity.edu.ng`, { idNumber: "<b>" });
  assert.equal(bazeBad.status, 400);
});

test("a session only works at the school it was made in (and old sessions without a school are Nile's)", async () => {
  const baze = await signup("baze", `b-${uid()}@bazeuniversity.edu.ng`);
  const nile = await signup("nile", `n-${uid()}@nileuniversity.edu.ng`);
  assert.equal(jwt.decode(baze.body.accessToken).sch, "baze");
  assert.equal(jwt.decode(nile.body.accessToken).sch, "nile");

  assert.equal((await call("GET", "/api/auth/me", { school: "baze", token: baze.body.accessToken })).status, 200);
  assert.equal((await call("GET", "/api/auth/me", { school: "nile", token: baze.body.accessToken })).status, 401);
  assert.equal((await call("GET", "/api/auth/me", { token: baze.body.accessToken })).status, 401, "no school = Nile");
  assert.equal((await call("GET", "/api/auth/me", { school: "baze", token: nile.body.accessToken })).status, 401);

  // a session made before there were several schools carries no school: it is Nile's, and only Nile's
  const old = jwt.sign({ sub: nile.body.user.id, email: nile.body.user.email, name: "Old" }, process.env.JWT_ACCESS_SECRET, { algorithm: "HS256", expiresIn: "5m" });
  assert.equal((await call("GET", "/api/auth/me", { token: old })).status, 200);
  assert.equal((await call("GET", "/api/auth/me", { school: "baze", token: old })).status, 401);

  // the renewal token is kept in the school's own database too
  const refreshAtNile = await call("POST", "/api/auth/refresh", { school: "nile", body: { refreshToken: baze.body.refreshToken } });
  assert.equal(refreshAtNile.status, 401);
  const refreshAtBaze = await call("POST", "/api/auth/refresh", { school: "baze", body: { refreshToken: baze.body.refreshToken } });
  assert.equal(refreshAtBaze.status, 200, JSON.stringify(refreshAtBaze.body));
});

test("lost posts, and the activity log they write, stay in their school", async () => {
  const baze = await signup("baze", `b-${uid()}@bazeuniversity.edu.ng`);
  const nile = await signup("nile", `n-${uid()}@nileuniversity.edu.ng`);
  const word = `umbrella-${uid()}`;
  const posted = await call("POST", "/api/lost-items", { school: "baze", token: baze.body.accessToken, body: { description: `Black ${word}`, location: "Library" } });
  assert.equal(posted.status, 201, JSON.stringify(posted.body));

  const atBaze = await call("GET", "/api/lost-items", { school: "baze", token: baze.body.accessToken });
  const atNile = await call("GET", "/api/lost-items", { school: "nile", token: nile.body.accessToken });
  assert.ok(atBaze.body.items.some((i) => i.description.includes(word)), "Baze students see it");
  assert.ok(!atNile.body.items.some((i) => i.description.includes(word)), "Nile students never do");
  assert.equal(countIn("nile", "SELECT COUNT(*) AS n FROM lost_items WHERE description LIKE ?", `%${word}%`), 0);

  // the activity log is written after the answer is sent ("finish"): it must still land in Baze's database
  await new Promise((r) => setTimeout(r, 100));
  const userId = baze.body.user.id;
  assert.ok(countIn("baze", "SELECT COUNT(*) AS n FROM activity_log WHERE user_id = ?", userId) > 0, "logged at Baze");
  assert.equal(countIn("nile", "SELECT COUNT(*) AS n FROM activity_log WHERE user_id = ?", userId), 0, "never at Nile");
});

test("a found-item photo is saved in its school's database and folder (an upload finishes outside the request)", async () => {
  const baze = await signup("baze", `b-${uid()}@bazeuniversity.edu.ng`);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const form = new FormData();
  form.append("photo", new Blob([png], { type: "image/png" }), "found.png");
  form.append("description", "Blue water bottle");
  form.append("location", "Cafeteria");
  const r = await call("POST", "/api/found-items", { school: "baze", token: baze.body.accessToken, form });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.item.photoUrl, /^\/uploads\/found-items\/baze\/[0-9a-f-]+\.png$/);
  assert.ok(fs.existsSync(path.join(process.env.UPLOAD_ROOT, r.body.item.photoUrl.replace("/uploads/", ""))));
  assert.equal(countIn("baze", "SELECT COUNT(*) AS n FROM found_items WHERE id = ?", r.body.item.id), 1);
  assert.equal(countIn("nile", "SELECT COUNT(*) AS n FROM found_items WHERE id = ?", r.body.item.id), 0);
});

test("links in emails say which school they are for", async () => {
  const lines = [];
  const real = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  try {
    assert.equal((await signup("baze", `b-${uid()}@bazeuniversity.edu.ng`)).status, 201);
    assert.equal((await signup("nile", `n-${uid()}@nileuniversity.edu.ng`)).status, 201);
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    console.log = real;
  }
  const links = lines.filter((l) => l.includes("verifyToken="));
  assert.ok(links.some((l) => /verifyToken=[0-9a-f]+&school=baze/.test(l)), links.join("\n"));
  assert.ok(links.some((l) => /verifyToken=[0-9a-f]+&school=nile/.test(l)), links.join("\n"));
  assert.ok(lines.some((l) => l.includes("Subject: Welcome to FoundIT")));
});

test("the daily jobs reach every school: backups go to each school's own folder, expiry runs in each database", () => {
  const files = db.forEachSchool(() => runBackup().file);
  assert.deepEqual(Object.keys(files).sort(), schools.SCHOOLS.map((s) => s.id).sort());
  assert.equal(backupDir("nile"), path.join(dir, "backups"), "the default school's backups stay where they were");
  for (const s of schools.SCHOOLS) {
    const folder = backupDir(s.id);
    if (s.id !== "nile") assert.equal(folder, path.join(dir, "backups", s.id));
    assert.ok(fs.existsSync(path.join(folder, files[s.id])), `${s.name} backup`);
  }
  const expired = db.forEachSchool(() => expireStaleItems());
  assert.equal(Object.keys(expired).length, schools.SCHOOLS.length);
});

test("the owner page signs in to one school at a time, and the server lists the schools for it", async () => {
  const r = await call("GET", "/api/schools");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.schools.map((s) => s.id), schools.SCHOOLS.map((s) => s.id));
  assert.equal(r.body.schools.find((s) => s.id === "veritas").open, false);
  assert.deepEqual(Object.keys(r.body.schools[0]).sort(), ["id", "name", "open"], "names only, nothing private");
  const page = fs.readFileSync(path.join(__dirname, "..", "owner-page", "owner.js"), "utf8");
  assert.match(page, /"X-School": school \|\| schoolOf\(\),/, "every owner-page request names its school");
  assert.match(page, /send\("\/api\/auth\/logout", \{ method: "POST", body: \{ refreshToken \}, school \}\)/, "signing out ends the sign-in in its own school");
});

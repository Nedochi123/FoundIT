// Who may join which school, and what a school's ID numbers look like, now come from one list (src/config/schools.js)
// instead of being written into the sign-up code. These tests pin the rules for the school that is live today
// (Nile) so that moving them into the list cannot loosen them, and check the list itself.
const test = require("node:test");
const assert = require("node:assert/strict");

const { SCHOOLS, DEFAULT_SCHOOL_ID, getSchool, allowedEmailDomain, emailBelongsTo, schoolForEmail } = require("../src/config/schools");
const { idNumberSchema, idNumberSchemaFor } = require("../src/utils/idNumber");
const { welcomeEmail } = require("../src/utils/email");

const ok = (schema, v) => schema.safeParse(v).success;

test("the list is well-formed: unique ids and names, the default school is open, and an open school has an email ending", () => {
  assert.equal(new Set(SCHOOLS.map((s) => s.id)).size, SCHOOLS.length);
  assert.equal(new Set(SCHOOLS.map((s) => s.name)).size, SCHOOLS.length);
  assert.ok(getSchool(DEFAULT_SCHOOL_ID).enabled, "the default school is open");
  for (const s of SCHOOLS) {
    if (s.enabled) assert.ok(s.emailDomain, `${s.name} is open, so it needs an email ending`);
    assert.ok(s.idPattern instanceof RegExp && s.idMessage);
    assert.match(s.id, /^[a-z]+$/);
  }
});

test("Nile's rules are unchanged: a nileuniversity.edu.ng email, and an ID of exactly 9 digits", () => {
  const nile = getSchool("nile");
  assert.equal(nile.name, "Nile University");
  assert.equal(allowedEmailDomain(nile), "nileuniversity.edu.ng");
  assert.ok(emailBelongsTo(nile, "123456789@nileuniversity.edu.ng"));
  assert.ok(emailBelongsTo(nile, "Ada@NileUniversity.edu.ng"), "capital letters do not matter");
  assert.ok(ok(idNumberSchema, "123456789"));
  assert.ok(ok(idNumberSchema, undefined), "the ID number is optional");
  for (const bad of ["12345678", "1234567890", "12345678a", "123 456 789", "BU/22/001", ""]) assert.ok(!ok(idNumberSchema, bad), `rejects ${JSON.stringify(bad)}`);
  assert.equal(idNumberSchemaFor("nile").safeParse("12345678").error.issues[0].message, "ID number must be exactly 9 digits, e.g. 123456789.");
});

test("an email only belongs to a school if it ends with exactly @ + that school's ending (look-alikes are refused)", () => {
  const nile = getSchool("nile");
  for (const bad of [
    "a@evilnileuniversity.edu.ng",
    "a@nileuniversity.edu.ng.evil.com",
    "a@nileuniversity.edu.ng@evil.com",
    "a@mail.nileuniversity.edu.ng",
    "nileuniversity.edu.ng",
    "a@bazeuniversity.edu.ng",
    "",
  ]) assert.ok(!emailBelongsTo(nile, bad), `refuses ${JSON.stringify(bad)}`);
});

test("the ALLOWED_EMAIL_DOMAIN setting still decides the default school's ending (it is set on the live server) and no other school's", () => {
  const before = process.env.ALLOWED_EMAIL_DOMAIN;
  try {
    process.env.ALLOWED_EMAIL_DOMAIN = "Example.EDU.ng";
    assert.equal(allowedEmailDomain(getSchool("nile")), "example.edu.ng");
    assert.equal(allowedEmailDomain(getSchool("baze")), "bazeuniversity.edu.ng", "another school keeps its own ending");
    delete process.env.ALLOWED_EMAIL_DOMAIN;
    assert.equal(allowedEmailDomain(getSchool("nile")), "nileuniversity.edu.ng");
  } finally {
    if (before === undefined) delete process.env.ALLOWED_EMAIL_DOMAIN;
    else process.env.ALLOWED_EMAIL_DOMAIN = before;
  }
});

test("only an OPEN school accepts people: a closed school's email, or an unknown one, belongs to nobody yet", () => {
  assert.equal(schoolForEmail("a@nileuniversity.edu.ng")?.id, "nile");
  assert.equal(schoolForEmail("a@bazeuniversity.edu.ng")?.id, "baze", "Baze is open");
  assert.equal(schoolForEmail("a@veritas.edu.ng"), null, "Veritas is not open yet");
  assert.equal(schoolForEmail("a@gmail.com"), null);
  assert.equal(schoolForEmail(""), null);
  // a school with no ending known yet can never match (an empty ending must not match every address)
  const unknown = { id: "later", name: "Later University", emailDomain: null, enabled: true };
  assert.ok(!emailBelongsTo(unknown, "a@anything.com"));
  assert.ok(!emailBelongsTo(unknown, "a@"));
  assert.ok(!emailBelongsTo(unknown, ""));
});

test("each school's email ending is its own real domain (checked in DNS on 2026-10-17: all five exist and receive mail)", () => {
  const endings = Object.fromEntries(SCHOOLS.map((s) => [s.id, s.emailDomain]));
  assert.deepEqual(endings, {
    nile: "nileuniversity.edu.ng",
    baze: "bazeuniversity.edu.ng",
    cosmopolitan: "cosmopolitan.edu.ng",
    philomath: "philomath.edu.ng",
    veritas: "veritas.edu.ng",
  });
  assert.equal(new Set(Object.values(endings)).size, SCHOOLS.length, "no two schools share an ending");
  for (const d of Object.values(endings)) assert.match(d, /^[a-z]+\.edu\.ng$/);
  // the made-up spellings (cosmopolitanuniversity.edu.ng and so on) do not exist, so they must never be accepted
  for (const s of SCHOOLS) assert.ok(!emailBelongsTo(s, `a@${s.id}university.edu.ng`) || s.id === "nile" || s.id === "baze");
  // a student of one school is never taken for another school's student
  assert.ok(emailBelongsTo(getSchool("veritas"), "ada@veritas.edu.ng"));
  assert.ok(!emailBelongsTo(getSchool("veritas"), "ada@philomath.edu.ng"));
  assert.ok(!emailBelongsTo(getSchool("philomath"), "ada@veritas.edu.ng"));
  assert.ok(!emailBelongsTo(getSchool("cosmopolitan"), "ada@cosmopolitanuniversity.edu.ng"));
});

test("a school whose ID format is not known yet accepts sensible IDs (letters, digits, / and -) and nothing else", () => {
  const philomath = idNumberSchemaFor("philomath");
  for (const good of ["BU/22/CSC/001", "22-1234", "20231234", "abcd"]) assert.ok(ok(philomath, good), `accepts ${good}`);
  for (const bad of ["ab", "a".repeat(21), "has space", "<script>", "12;34", "é1234"]) assert.ok(!ok(philomath, bad), `rejects ${JSON.stringify(bad)}`);
  assert.ok(ok(philomath, undefined));
  // an unknown school id falls back to the default school's rules, never to "anything goes"
  assert.ok(!ok(idNumberSchemaFor("nowhere"), "BU/22/001"));
  assert.ok(ok(idNumberSchemaFor("nowhere"), "123456789"));
});

test("Baze is open, and its ID numbers are digits (a Baze email is the surname followed by the ID number)", () => {
  const baze = getSchool("baze");
  assert.equal(baze.enabled, true);
  assert.ok(emailBelongsTo(baze, "surname12345@bazeuniversity.edu.ng"));
  const ids = idNumberSchemaFor("baze");
  for (const good of ["12345", "1234", "12345678"]) assert.ok(ok(ids, good), `accepts ${good}`);
  for (const bad of ["123", "123456789", "BU/22/001", "12a45", "12 345", ""]) assert.ok(!ok(ids, bad), `rejects ${JSON.stringify(bad)}`);
  assert.equal(ids.safeParse("BU/22/001").error.issues[0].message, "Baze ID number must be digits only, e.g. 12345.");
  // the other two are still closed
  for (const id of ["philomath", "veritas"]) assert.equal(getSchool(id).enabled, false, id);
});

test("Cosmopolitan is open: its real domain only, and IDs as on its card (or just the number, which may start with 0)", () => {
  const cosmo = getSchool("cosmopolitan");
  assert.equal(cosmo.enabled, true);
  assert.equal(schoolForEmail("surname0123@cosmopolitan.edu.ng")?.id, "cosmopolitan");
  assert.equal(schoolForEmail("surname0123@cosmopolitanuniversity.edu.ng"), null, "that domain does not exist: nobody may join with it");
  const ids = idNumberSchemaFor("cosmopolitan");
  for (const good of ["25C-ABC-DEF-0123", "24c-abc-de-012", "0042", "0123", "12345678"]) assert.ok(ok(ids, good), `accepts ${good}`);
  for (const bad of ["045", "123456789", "CU/22/001", "04a5", "25C-ABC-DEF", "25C ABC DEF 0123", "25C-ABC-DEF-0123;", ""]) assert.ok(!ok(ids, bad), `rejects ${JSON.stringify(bad)}`);
  assert.match(ids.safeParse("CU/22/001").error.issues[0].message, /as on your ID card/);
});

test("the welcome email names the school it is for, and says Nile for the default", () => {
  assert.match(welcomeEmail("Ada", null), /FoundIT is Nile University's campus lost &amp; found\./);
  assert.match(welcomeEmail("Ada", null, "Baze University"), /FoundIT is Baze University's campus lost &amp; found\./);
  assert.ok(!/Nile/.test(welcomeEmail("Ada", null, "Baze University")), "no other school's name leaks in");
});

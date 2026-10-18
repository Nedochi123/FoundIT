// FoundIT serves several schools. A school's name, email ending, ID format and logo live in ONE list
// (src/lib/schools.js); every screen reads from it. These tests keep that true (no screen quietly goes back to
// naming one school), check the Welcome page and its floating logos, and make sure the website's list and the
// server's list agree.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import {
  SCHOOLS,
  DEFAULT_SCHOOL_ID,
  getSchool,
  isOpen,
  emailExample,
  handInTo,
  idFormat,
  idInputProps,
  idHint,
  readChosenSchoolId,
  rememberSchoolId,
  forgetSchoolId,
} from "../src/lib/schools.js";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const files = (dir, ext, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files(p, ext, out);
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
};

// a tiny stand-in for the browser's localStorage
function withStorage(initial, fn) {
  const store = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return fn(store);
  } finally {
    delete globalThis.localStorage;
  }
}

test("the list is well-formed: the five schools in order, unique ids, the default is open, an open school has an email ending", () => {
  assert.deepEqual(
    SCHOOLS.map((s) => s.name),
    ["Nile University", "Baze University", "Cosmopolitan University", "Philomath University", "Veritas University"]
  );
  assert.equal(new Set(SCHOOLS.map((s) => s.id)).size, SCHOOLS.length);
  assert.ok(isOpen(getSchool(DEFAULT_SCHOOL_ID)));
  for (const s of SCHOOLS) {
    assert.match(s.id, /^[a-z]+$/);
    assert.equal(s.logo, `/schools/${s.id}.png`, "each school's logo lives in public/schools/<id>.png");
    assert.match(s.color, /^#[0-9a-f]{6}$/i);
    assert.match(s.markText, /^#[0-9a-f]{6}$/i);
    assert.equal(s.mark, s.name[0], "the fallback initial is the school's first letter");
    if (s.enabled) assert.ok(s.emailDomain, `${s.name} is open, so it needs an email ending`);
  }
});

test("a screen can always ask for a school: unknown or missing ids give the default school", () => {
  assert.equal(getSchool("baze").short, "Baze");
  for (const bad of [undefined, null, "", "nowhere", "__proto__"]) assert.equal(getSchool(bad).id, DEFAULT_SCHOOL_ID);
});

test("what screens say about a school comes from its entry: email example, and who to hand a found item to", () => {
  assert.equal(emailExample(getSchool("nile")), "yourIDnumber@nileuniversity.edu.ng");
  assert.equal(emailExample(getSchool("baze")), "surname12345@bazeuniversity.edu.ng", "a Baze email is the surname followed by the ID number");
  assert.equal(emailExample(getSchool("veritas")), "yourIDnumber@veritas.edu.ng");
  assert.equal(emailExample(getSchool("cosmopolitan")), "surname0123@cosmopolitan.edu.ng");
  assert.equal(emailExample(getSchool("philomath")), "yourIDnumber@philomath.edu.ng");
  assert.equal(emailExample({ emailDomain: null }), "Your school email", "no ending is invented for a school that has none yet");
  assert.equal(handInTo(getSchool("nile")), "Nile University campus security");
  assert.equal(handInTo(getSchool("philomath")), "Philomath University campus security");
});

test("ID number boxes follow the school: Nile is 9 digits, a school with no known format takes letters, digits, / and -", () => {
  const nile = idInputProps(getSchool("nile"));
  assert.deepEqual(nile, { inputMode: "numeric", maxLength: 9, placeholder: "123456789", pattern: "\\d{9}", title: "Format: 9 digits, e.g. 123456789" });
  assert.equal(idHint(getSchool("nile")), "Format: 9 digits, e.g. 123456789");
  const baze = idInputProps(getSchool("baze"));
  assert.deepEqual(baze, { inputMode: "numeric", maxLength: 8, placeholder: "12345", pattern: "\\d{4,8}", title: "Format: digits only, e.g. 12345" });
  assert.ok(new RegExp(`^${baze.pattern}$`).test("12345") && !new RegExp(`^${baze.pattern}$`).test("BU/22/001"));
  const cosmo = idInputProps(getSchool("cosmopolitan"));
  assert.equal(cosmo.placeholder, "0123", "Cosmopolitan IDs may start with 0");
  assert.ok(new RegExp(`^${cosmo.pattern}$`).test("0455") && !new RegExp(`^${cosmo.pattern}$`).test("CU/22/001"));
  const other = idInputProps(getSchool("philomath"));
  assert.equal(other.inputMode, "text");
  assert.equal(other.maxLength, 20);
  assert.ok(new RegExp(`^${other.pattern}$`).test("BU/22/CSC/001"));
  assert.ok(!new RegExp(`^${other.pattern}$`).test("has space"));
  assert.equal(idFormat(undefined).maxLength, 20);
});

test("a device remembers its school, but only an OPEN one, and ignores junk", () => {
  withStorage({}, () => {
    assert.equal(readChosenSchoolId(), null, "nothing chosen yet: the Welcome page shows");
    rememberSchoolId("nile");
    assert.equal(readChosenSchoolId(), "nile");
    forgetSchoolId();
    assert.equal(readChosenSchoolId(), null);
  });
  withStorage({ foundit_school: "baze" }, () => assert.equal(readChosenSchoolId(), "baze", "Baze is open"));
  withStorage({ foundit_school: "veritas" }, () => assert.equal(readChosenSchoolId(), null, "a school that is not open cannot be the saved one"));
  withStorage({ foundit_school: "<img onerror=x>" }, () => assert.equal(readChosenSchoolId(), null));
  // storage that throws (private browsing) must not break the page
  globalThis.localStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  try {
    assert.equal(readChosenSchoolId(), null);
    rememberSchoolId("nile");
    forgetSchoolId();
  } finally {
    delete globalThis.localStorage;
  }
});

test("no screen names a school itself: the website's code mentions Nile only inside the school list", () => {
  const bad = [];
  for (const p of files(join(ROOT, "src"), [".js", ".jsx"])) {
    if (p.replaceAll("\\", "/").endsWith("src/lib/schools.js")) continue;
    if (/nile/i.test(readFileSync(p, "utf8"))) bad.push(relative(ROOT, p).replaceAll("\\", "/"));
  }
  assert.deepEqual(bad, [], "read the school from useSchool() / lib/schools.js instead");
});

test("no screen hard-codes an ID format: every ID number box takes its rules from the school", () => {
  const bad = [];
  for (const p of files(join(ROOT, "src", "components"), [".jsx"])) {
    const t = readFileSync(p, "utf8");
    if (/\\d\{9\}|maxLength=\{9\}|9 digits|(?<![0-9])123456789(?![0-9])/.test(t)) bad.push(relative(ROOT, p).replaceAll("\\", "/"));
    if (/-idnumber"/.test(t)) assert.match(t, /\{\.\.\.idInputProps\(school\)\}/, `${p} asks for an ID number without the school's rules`);
  }
  assert.deepEqual(bad, []);
});

test("the Welcome page lists every school, is the first thing shown to someone with no school chosen, and tells the truth about a school that is not open", () => {
  const welcome = read("src/components/auth/Welcome.jsx");
  assert.match(welcome, /SCHOOLS\.map\(/, "every school in the list gets a button");
  assert.match(welcome, /<SchoolLogoField \/>/, "the logos float behind it");
  assert.match(welcome, /Opening soon/);
  assert.match(welcome, /isn't open on FoundIT yet/);
  assert.ok(!/<button[^>]*\bdisabled\b/.test(welcome), "a school that is not open still answers a tap");
  const gate = read("src/components/auth/AuthGate.jsx");
  assert.match(gate, /if \(!chosen\) return <Welcome /);
  assert.ok(gate.indexOf("if (user) return children;") < gate.indexOf("if (!chosen)"), "someone already signed in is never sent back to the Welcome page");
  assert.match(gate, /\{school\.name\}/, "the sign-in screen names the chosen school");
  assert.match(gate, /Change school/);
  assert.match(read("src/App.jsx"), /<SchoolProvider>/);
});

test("the floating logos: every school appears, they ignore taps, and they stop for reduced motion and 'Keep doodles still'", () => {
  const field = read("src/components/school/SchoolLogoField.jsx");
  const slots = [...field.matchAll(/\{ x: \d+, y: \d+, size: \d+/g)].length;
  assert.ok(slots >= SCHOOLS.length * 2, `enough floating logos that every school shows more than once (${slots})`);
  assert.match(field, /schools\[i % schools\.length\]/, "the logos are shared out across all schools");
  assert.match(field, /className="doodle-field"/);
  assert.match(field, /aria-hidden="true"/);
  assert.match(field, /doodle school-logo doodle-\$\{slot\.move\}/, "they reuse the doodles' own drifts");
  const css = read("src/index.css");
  assert.match(css, /\.doodle-field \{[^}]*pointer-events: none/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.doodle \{\s*animation: none !important/);
  assert.match(css, /:root\[data-still\] \.doodle \{\s*animation: none !important/);
  assert.ok(css.indexOf(".school-logo {") > css.indexOf(".doodle {"), ".school-logo comes after .doodle so its opacity wins");
  assert.match(css, /\.school-badge \{[^}]*background: #ffffff/, "logos sit on a white badge so dark crests stay readable");
});

test("a missing logo file falls back to a colored initial instead of a broken image", () => {
  const mark = read("src/components/school/SchoolMark.jsx");
  assert.match(mark, /onError=\{\(\) => setBroken\(true\)\}/);
  assert.match(mark, /school\.mark/);
  assert.match(mark, /aria-hidden="true"/, "decorative: the school's name is always written beside it");
});

test("the website's list of schools and the server's list agree", () => {
  const require = createRequire(import.meta.url);
  const server = require(join(ROOT, "..", "backend", "src", "config", "schools.js"));
  assert.equal(DEFAULT_SCHOOL_ID, server.DEFAULT_SCHOOL_ID);
  assert.deepEqual(
    SCHOOLS.map((s) => [s.id, s.name, s.emailDomain, s.enabled]),
    server.SCHOOLS.map((s) => [s.id, s.name, s.emailDomain, s.enabled])
  );
  const nile = SCHOOLS.find((s) => s.id === "nile");
  assert.equal(`^${nile.idFormat.pattern}$`, server.getSchool("nile").idPattern.source.replace(/^\^?/, "^").replace(/\$?$/, "$"));
  assert.equal(idFormat(nile).maxLength, 9);
});

test("every school has its official badge: a real 256x256 PNG in public/schools, small enough to load quickly", () => {
  for (const s of SCHOOLS) {
    const file = join(ROOT, "public", s.logo.slice(1));
    assert.ok(existsSync(file), `${s.name}'s logo file is missing: ${s.logo}`);
    const bytes = readFileSync(file);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${s.logo} is a PNG (rendered to pixels, so it cannot carry a script)`);
    assert.equal(bytes.readUInt32BE(16), 256, "256 wide");
    assert.equal(bytes.readUInt32BE(20), 256, "256 tall");
    assert.ok(bytes.length < 80_000, `${s.logo} is ${bytes.length} bytes; keep each badge small`);
  }
});

test("the logos are not downloaded with the app: they load on the Welcome page, not on every install", () => {
  assert.ok(read("vite.config.js").includes('"schools/**"'), "schools/** is in the service worker's ignore list");
});

test("a school whose official logo is white sits on its own dark badge, so it can be seen", () => {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const s of SCHOOLS) if (s.badge) assert.match(s.badge, /^#[0-9a-f]{6}$/i);
  const philomath = getSchool("philomath");
  assert.ok(lum(philomath.badge) < 0.02, "a white crest needs a dark badge");
  assert.ok((1.05) / (lum(philomath.badge) + 0.05) > 7, "white on Philomath's badge is easy to read");
  assert.ok(read("src/components/school/SchoolMark.jsx").includes("school.badge ? { background: school.badge }"), "the badge color is applied");
});

test("every request names its school, so the server uses that school's own database", async () => {
  const api = read("src/lib/api.js");
  assert.match(api, /"X-School": requestSchoolId,/, "the header is on every request");
  assert.match(api, /requestSchoolId = getSchool\(id\)\.id;/, "an unknown school can never be sent: it becomes the default");
  const provider = read("src/components/school/SchoolProvider.jsx");
  assert.match(provider, /setApiSchool\(id \|\| DEFAULT_SCHOOL_ID\); \/\/ before any screen sends its first request/);
  assert.match(provider, /setApiSchool\(next\);/, "switching school takes effect at once");
  assert.match(read("src/components/tags/TagScan.jsx"), /setApiSchool\(s\.id\);/, "a finder's page asks the sticker's school");
});

test("a QR sticker names its school, except the default school's, whose printed stickers keep working unchanged", async () => {
  const { tagUrl } = await import("../src/lib/schools.js");
  assert.equal(tagUrl("https://app.example", "ABCD1234", getSchool("nile")), "https://app.example/t/ABCD1234");
  assert.equal(tagUrl("https://app.example", "ABCD1234", getSchool("baze")), "https://app.example/t/ABCD1234?school=baze");
  assert.equal(tagUrl("https://app.example", "ABCD1234", undefined), "https://app.example/t/ABCD1234");
  assert.match(read("src/components/admin/AdminTagsScreen.jsx"), /QRCode\.toDataURL\(tagUrl\(origin, c, school\)/);
});

test("a link from an email opens in its own school: ?school= is read only if it is a known, open school", async () => {
  const { readSchoolFromUrl } = await import("../src/lib/schools.js");
  const at = (search, fn) => {
    globalThis.window = { location: { search } };
    try {
      return fn();
    } finally {
      delete globalThis.window;
    }
  };
  assert.equal(at("?verifyToken=abc&school=nile", readSchoolFromUrl), "nile");
  assert.equal(at("?verifyToken=abc&school=baze", readSchoolFromUrl), "baze");
  assert.equal(at("?verifyToken=abc&school=veritas", readSchoolFromUrl), null, "Veritas is not open yet");
  assert.equal(at("?school=hogwarts", readSchoolFromUrl), null);
  assert.equal(at("", readSchoolFromUrl), null);
  assert.equal(readSchoolFromUrl(), null, "no window (or a blocked one) is not an error");
});

test("Baze has its own colors: offered only to Baze students, shown to them by default, and readable", async () => {
  const { THEMES, getTheme } = await import("../src/lib/themes.js");
  const baze = getSchool("baze");
  assert.equal(baze.enabled, true);
  assert.equal(baze.theme, "baze");
  assert.equal(getTheme("baze").id, "baze", "the school's colors exist");
  assert.equal(getTheme("baze").school, "baze");
  for (const s of SCHOOLS) if (s.theme) assert.ok(THEMES.some((t) => t.id === s.theme), s.id);
  assert.equal(getSchool("nile").theme, undefined, "Nile keeps the original FoundIT look");
  const picker = read("src/components/theme/ThemePicker.jsx");
  assert.match(picker, /THEMES\.filter\(\(t\) => !t\.school \|\| t\.school === school\.id\)/, "another school's colors are not offered");
  const provider = read("src/components/theme/ThemeProvider.jsx");
  assert.match(provider, /if \(savedTheme \|\| !chosen\) return;/, "a signed-in student's saved look always wins");
  assert.match(provider, /theme: school\.theme \|\| DEFAULT_THEME/);
  assert.match(read("src/themes.css"), /\[data-theme="baze"\]/, "its CSS is generated");
  assert.match(read("public/manifests/baze.json"), /"theme_color"/, "and its Home Screen icon");
});

test("Baze: grey structure with blue only for buttons and links, and good contrast: buttons stand out and their white text is readable", async () => {
  const { getTheme } = await import("../src/lib/themes.js");
  const t = getTheme("baze");
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (x, y) => {
    const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p);
    return (a + 0.05) / (b + 0.05);
  };
  const css = read("src/themes.css");
  const block = css.slice(css.indexOf('[data-theme="baze"]'));
  const slate900 = block.match(/--slate-900:\s*([0-9 ]+);/)[1].trim().split(/\s+/).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  const card = "#" + slate900;
  for (const end of [t.brand.a, t.brand.b]) {
    assert.ok(ratio(end, card) >= 3, `button ${end} vs card ${card}: ${ratio(end, card).toFixed(2)}`);
    assert.ok(ratio(end, t.bg.mid) >= 3, `button ${end} vs page ${t.bg.mid}: ${ratio(end, t.bg.mid).toFixed(2)}`);
    assert.ok(ratio("#ffffff", end) >= 4.5, `white on button ${end}: ${ratio("#ffffff", end).toFixed(2)}`);
  }
  assert.ok(ratio(t.brand.text, t.bg.mid) >= 7, "links and the IT in FoundIT are near-white");
  // grey is the structure (the page and the grey half of the button and logo); blue is only for "tap here"
  const isGrey = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return Math.max(r, g, b) - Math.min(r, g, b) <= 12;
  };
  for (const hex of [t.brand.a, t.bg.mid, t.bg.top, t.bg.bottom, t.chrome]) assert.ok(isGrey(hex), `${hex} is one of Baze's greys`);
  assert.ok(!isGrey(t.brand.b) && !isGrey(t.brand.text), "the button's other half and the links stay blue, so they read as tappable");
});

test("every school's own colors have good contrast: buttons stand out from the card and page, their white text and the links are readable", async () => {
  const { getTheme } = await import("../src/lib/themes.js");
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (x, y) => {
    const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p);
    return (a + 0.05) / (b + 0.05);
  };
  const css = read("src/themes.css");
  const withThemes = SCHOOLS.filter((s) => s.theme);
  assert.ok(withThemes.length >= 2, "Baze and Cosmopolitan have their own colors");
  for (const school of withThemes) {
    const t = getTheme(school.theme);
    assert.equal(t.id, school.theme, school.id);
    assert.equal(t.school, school.id, "a school's colors are offered only to that school");
    const block = css.slice(css.indexOf(`[data-theme="${t.id}"]`));
    const card = "#" + block.match(/--slate-900:\s*([0-9 ]+);/)[1].trim().split(/\s+/).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
    for (const end of [t.brand.a, t.brand.b]) {
      assert.ok(ratio(end, card) >= 3, `${school.id}: button ${end} vs card ${card}`);
      assert.ok(ratio(end, t.bg.mid) >= 3, `${school.id}: button ${end} vs page`);
      assert.ok(ratio("#ffffff", end) >= 4.5, `${school.id}: white on button ${end}`);
    }
    assert.ok(ratio(t.brand.text, t.bg.mid) >= 4.5, `${school.id}: links`);
    assert.ok(read(`public/manifests/${t.id}.json`).includes('"theme_color"'), `${school.id}: Home Screen icon`);
  }
});

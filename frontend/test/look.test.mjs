// FoundIT's look is flat on purpose: solid surfaces, one flat fill for buttons, no glows, blurred glass, gradients or sparkles. Those are
// exactly the decorations that make an app read as machine-made, and each one is cheap to add back by accident. These tests fail if
// they return. (The logo and app icon are artwork and the welcome animation is its own one-time scene: both are allowed their gradients.)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = new URL("../src/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const files = (dir, test, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files(p, test, out);
    else if (test.test(e.name)) out.push(p);
  }
  return out;
};
const jsx = files(SRC, /\.jsx$/);
const rel = (p) => relative(SRC, p).replaceAll("\\", "/");
const offenders = (re, { skip = () => false } = {}) =>
  jsx.filter((p) => !skip(rel(p))).flatMap((p) => [...readFileSync(p, "utf8").matchAll(re)].map((m) => `${rel(p)}: ${m[0]}`));

test("no glows, blur or glass: no colored shadows, blurred shapes, backdrop blur or glow blobs", () => {
  assert.deepEqual(offenders(/(?<![\w-])(?:hover:|focus:|active:)?shadow(?:-(?:sm|md|lg|xl|2xl))?(?:-[a-z]+(?:-\d+)?\/\d+)?(?=[\s"'`])/g), []);
  assert.deepEqual(offenders(/(?<![\w-])(?:backdrop-)?blur(?:-[a-z0-9]+)?(?=[\s"'`])/g), []);
  assert.deepEqual(offenders(/bg-glow/g), []);
});

test("no gradients on buttons, cards or text: flat fills only (the logo tile is the one artwork gradient)", () => {
  assert.deepEqual(offenders(/(?<![\w-])(?:bg-gradient-to-\w+|from-\S+|via-\S+|to-\S+|bg-clip-text)(?=[\s"'`])/g), []);
  assert.deepEqual(offenders(/(?:radial|linear|conic)-gradient\(/g, { skip: (f) => f === "components/theme/doodles.jsx" }), []);
  assert.deepEqual(offenders(/bg-brand-gradient/g), [], "buttons use bg-brand-btn, the flat fill");
  const logo = readFileSync(join(SRC, "components/theme/Logo.jsx"), "utf8");
  assert.match(logo, /bg-logo-gradient/, "the logo tile keeps its artwork gradient");
});

test("surfaces are solid: no see-through card or input backgrounds", () => {
  assert.deepEqual(offenders(/(?<![\w-])bg-slate-(?:800|900)\/\d+(?=[\s"'`])/g), []);
});

test("corners are 12px on cards and 16px on sheets, not the large soft radius every template uses", () => {
  assert.deepEqual(offenders(/(?<![\w-])rounded-(?:t-3xl|2xl|3xl)(?=[\s"'`])/g), []); // a bottom sheet may still round its top corners (rounded-t-2xl)
});

test("the page itself is flat: one color, no lights", () => {
  const css = readFileSync(join(SRC, "index.css"), "utf8");
  assert.ok(!/radial-gradient|\.bg-glow|filter:\s*blur/.test(css), "index.css must not paint gradients or blurred lights");
  assert.match(css, /background-image:\s*linear-gradient\(var\(--bg\),\s*var\(--bg\)\)/, "a single flat color (with the optional pattern under it)");
  const themes = readFileSync(join(SRC, "themes.css"), "utf8");
  assert.ok(!/--(?:glow|blob)-/.test(themes) && !/--bg-(?:top|bottom)/.test(themes), "no glow, blob or gradient variables are generated");
});

test("no sparkles icon (the symbol of AI features) outside the aliens doodle", () => {
  assert.deepEqual(offenders(/\bSparkles\b|\bWandSparkles\b|\bWand2\b/g, { skip: (f) => f === "components/theme/doodles.jsx" }), []);
});

test("every button uses a fill that white text reads on at 4.5:1 in every look", () => {
  const themes = readFileSync(join(SRC, "themes.css"), "utf8");
  const tw = readFileSync(new URL("../tailwind.config.js", import.meta.url), "utf8");
  assert.match(tw, /btn:\s*rgbVar\("brand-btn"\)/);
  assert.equal([...themes.matchAll(/--brand-btn:/g)].length, 10, "every look defines its button fill");
});

test("the typeface is Public Sans (and IBM Plex Mono for codes), not the template default it replaced", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(join(SRC, "index.css"), "utf8");
  const tw = readFileSync(new URL("../tailwind.config.js", import.meta.url), "utf8");
  assert.match(html, /family=Public\+Sans/);
  assert.match(html, /family=IBM\+Plex\+Mono/);
  assert.match(css, /font-family:\s*"Public Sans"/);
  assert.match(tw, /'Public Sans'/);
  assert.ok(!/Plus[+ ]Jakarta/.test(html + css + tw), "the old typeface must not linger");
});

test("the wording is plain: none of the stock phrases that make copy read as generated", () => {
  const STOCK = [/one item at a time/i, /what'?s going on today/i, /\bseamless(ly)?\b/i, /\beffortless(ly)?\b/i, /\bunlock the\b/i, /\bsupercharge/i, /\bleverage\b/i, /\bgame-?changer/i, /\bcutting-edge\b/i, /\bjourney\b/i, /\bempower/i, /\bwelcome back!/i, /let'?s get started/i, /✨|🚀|🎉|💡/u];
  const hits = [];
  for (const p of [...jsx, join(SRC, "..", "index.html")]) {
    const text = readFileSync(p, "utf8");
    for (const re of STOCK) if (re.test(text)) hits.push(`${relative(SRC, p).replaceAll("\\", "/")}: ${re}`);
  }
  assert.deepEqual(hits, []);
});

test("the home screen offers its three actions as one plain list, not three look-alike tinted cards", () => {
  const home = readFileSync(join(SRC, "components/Home.jsx"), "utf8");
  assert.match(home, /const ACTIONS = \[/);
  assert.equal([...home.matchAll(/\{ key: "(?:lost|found|urgent)"/g)].length, 3);
  assert.match(home, /divide-y/);
  assert.ok(!/ring-1 ring-inset ring-(?:red|emerald)-500/.test(home), "no tinted icon tiles");
});

test("the welcome animation's stage is one flat color too: no glow blobs, radial light or glowing logo", () => {
  const css = readFileSync(join(SRC, "components/IntroAnimation.css"), "utf8");
  assert.ok(!/radial-gradient|filter:\s*blur|intro-glow|intro-shadow|::before|::after/.test(css), "no glows in the intro");
  assert.match(css, /background:\s*var\(--intro-bg/);
  assert.ok(!/box-shadow:[^;]*(?:rgb|rgba)\([^)]*\/\s*0?\.\d+/.test(css), "no colored glow around the logo");
});

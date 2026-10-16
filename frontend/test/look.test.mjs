// FoundIT's look is the original one, by Nedochi's choice (a flatter redesign was tried on 2026-10-16 and taken out the same day). These
// tests only stop it from being changed by accident, for example by a clean-up that strips the glows and gradients: the look can still be
// changed on purpose, by changing this file with it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the original look is in place: Plus Jakarta Sans, the teal-to-blue button gradient, the glowing page and glass cards", () => {
  const html = read("index.html");
  const css = read("src/index.css");
  const tw = read("tailwind.config.js");
  assert.match(html, /family=Plus\+Jakarta\+Sans/);
  assert.match(css, /font-family:\s*"Plus Jakarta Sans"/);
  assert.match(tw, /"brand-gradient":\s*"linear-gradient\(135deg, var\(--brand-a\) 0%, var\(--brand-b\) 100%\)"/);
  assert.match(css, /\.bg-glow\s*\{/, "the soft glow behind every screen");
  assert.match(css, /radial-gradient\(circle at 50% -10%, var\(--bg-top\)/, "the page gradient");
  assert.match(read("src/components/layout/Layout.jsx"), /backdrop-blur-md/, "the frosted top bar");
});

test("the sign-in screen and the Home screen keep their original wording and cards", () => {
  assert.match(read("src/components/auth/AuthGate.jsx"), /Reuniting campus, one item at a time\./);
  const home = read("src/components/Home.jsx");
  assert.match(home, /What's going on today\?/);
  assert.match(home, /I lost something/);
  assert.match(home, /I urgently need something/);
  assert.match(home, /I found something/);
});

test("the Default color is described as the original FoundIT look", () => {
  assert.match(read("src/components/theme/ThemePicker.jsx"), /original FoundIT look/);
});

// Every color theme must be complete: a missing field shows up as a broken page, a blank icon or an unreadable
// intro animation only for the students who chose that theme.
import test from "node:test";
import assert from "node:assert/strict";
import { THEMES, DOODLES, THEME_IDS, DOODLE_IDS, DEFAULT_THEME, DEFAULT_DOODLE, getTheme, normalizeLook } from "../src/lib/themes.js";

const COLOR = /^(#[0-9a-f]{6}|rgba?\([^)]+\)|transparent)$/i;

test("theme and doodle ids are unique and the defaults exist", () => {
  assert.equal(new Set(THEME_IDS).size, THEMES.length);
  assert.equal(new Set(DOODLE_IDS).size, DOODLES.length);
  assert.ok(THEME_IDS.includes(DEFAULT_THEME));
  assert.ok(DOODLE_IDS.includes(DEFAULT_DOODLE));
  assert.equal(THEMES[0].id, DEFAULT_THEME, "unknown ids fall back to the first theme, which must be the default");
});

test("every theme has all the parts the app reads", () => {
  for (const t of THEMES) {
    const where = `theme "${t.id}"`;
    assert.ok(t.label, `${where} has a label`);
    assert.match(t.chrome, COLOR, `${where} chrome`);
    assert.match(t.doodle, COLOR, `${where} doodle color`);
    assert.ok(t.swatchBg, `${where} has a swatch`);
    assert.ok(DOODLE_IDS.includes(t.suggestedDoodle), `${where} suggests a doodle that exists`);
    for (const key of ["a", "b", "text", "shadow"]) assert.match(t.brand[key], COLOR, `${where} brand.${key}`);
    for (const key of ["top", "mid", "bottom"]) {
      assert.match(t.bg[key], COLOR, `${where} bg.${key}`);
      assert.match(t.intro[key], COLOR, `${where} intro.${key}`);
    }
    for (const key of ["glowOne", "glowTwo"]) assert.match(t.intro[key], COLOR, `${where} intro.${key}`);
    for (const key of ["one", "two"]) {
      assert.match(t.glow[key], COLOR, `${where} glow.${key}`);
      assert.match(t.blobs[key], COLOR, `${where} blobs.${key}`);
    }
    if (t.neutral) assert.ok(t.neutral.hue >= 0 && t.neutral.hue <= 360 && t.neutral.sat >= 0, `${where} neutral`);
  }
});

test("unknown or missing choices fall back to the default look", () => {
  assert.equal(getTheme("no-such-theme").id, DEFAULT_THEME);
  assert.equal(getTheme(undefined).id, DEFAULT_THEME);
  assert.deepEqual(normalizeLook(undefined), { theme: DEFAULT_THEME, doodle: DEFAULT_DOODLE });
  assert.deepEqual(normalizeLook({ theme: "nope", doodle: "nope" }), { theme: DEFAULT_THEME, doodle: DEFAULT_DOODLE });
  assert.deepEqual(normalizeLook({ theme: "camo", doodle: "dogs" }), { theme: "camo", doodle: "dogs" });
});

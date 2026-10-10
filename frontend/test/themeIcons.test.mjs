// The Home Screen icon follows the saved color through one manifest per theme (see scripts/build-theme-icons.mjs).
// These fail if a theme is added without running `npm run themes:icons`, or if a manifest drifts from the real one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { THEMES, DEFAULT_THEME } from "../src/lib/themes.js";

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(pub, p), "utf8"));
const base = readJson("manifest.json");
const colored = THEMES.filter((t) => t.id !== DEFAULT_THEME);

test("every color has a manifest that is the same app with its own icons", () => {
  assert.ok(colored.length >= 9);
  for (const t of colored) {
    const m = readJson(`manifests/${t.id}.json`);
    for (const key of ["name", "short_name", "start_url", "scope", "display", "orientation", "background_color"]) {
      assert.equal(m[key], base[key], `${t.id}: ${key} matches manifest.json`);
    }
    assert.equal(m.theme_color, t.chrome, `${t.id}: bar color is the theme's`);
    assert.ok(m.icons.some((i) => i.purpose === "maskable"), `${t.id} has a maskable icon`);
    assert.deepEqual(
      m.icons.filter((i) => !i.purpose).map((i) => i.sizes),
      base.icons.filter((i) => !i.purpose).map((i) => i.sizes),
      `${t.id} has the same sizes as the default icons`
    );
  }
});

test("every icon a manifest names exists and is the size it says", async () => {
  for (const t of colored) {
    for (const icon of readJson(`manifests/${t.id}.json`).icons) {
      const file = path.join(pub, icon.src);
      assert.ok(fs.existsSync(file), `${icon.src} exists`);
      const meta = await sharp(file).metadata();
      assert.equal(`${meta.width}x${meta.height}`, icon.sizes, `${icon.src} is ${icon.sizes}`);
    }
  }
});

test("the default color keeps the original manifest and icons", () => {
  assert.ok(!fs.existsSync(path.join(pub, "manifests", `${DEFAULT_THEME}.json`)));
  for (const icon of base.icons) assert.ok(fs.existsSync(path.join(pub, icon.src)), icon.src);
});

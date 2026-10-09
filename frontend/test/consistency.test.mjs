// The website and the server each keep their own copy of a few lists (the app looks, the item types, the reward
// amounts). If one is edited and the other forgotten, students hit confusing "invalid choice" errors, so this
// fails the moment they drift apart.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { THEME_IDS, DOODLE_IDS, DEFAULT_THEME, DEFAULT_DOODLE } from "../src/lib/themes.js";
import { REWARD_AMOUNTS } from "../src/lib/rewards.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const server = (file) => require(path.join(here, "..", "..", "backend", "src", "utils", file));

test("app colors and doodle styles match the server's lists", () => {
  const s = server("themes.js");
  assert.deepEqual([...THEME_IDS].sort(), [...s.THEMES].sort());
  assert.deepEqual([...DOODLE_IDS].sort(), [...s.DOODLES].sort());
  assert.equal(DEFAULT_THEME, s.DEFAULT_THEME);
  assert.equal(DEFAULT_DOODLE, s.DEFAULT_DOODLE);
});

test("reward amounts match the server's list", () => {
  assert.deepEqual(REWARD_AMOUNTS, server("rewards.js").REWARD_AMOUNTS);
});

test("item types match the server's list", () => {
  // read as text because the website's copy imports icons, which need the full install to load
  const source = fs.readFileSync(path.join(here, "..", "src", "lib", "itemCategories.js"), "utf8");
  const block = source.slice(source.indexOf("export const ITEM_CATEGORIES"), source.indexOf("];"));
  const values = [...block.matchAll(/value:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(values, server("itemCategories.js").ITEM_CATEGORIES);
});

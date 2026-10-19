// The gallery lists only items still waiting for their owner: once the owner confirms the return, the item leaves the
// gallery automatically (the server stops listing it; backend/test/school-journeys.test.js checks that). These tests
// guard the app side: the gallery asks only for open items, and a gallery that is already open refreshes itself, so a
// returned item disappears without the student having to leave the screen and come back.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const gallery = readFileSync(join(ROOT, "src/components/gallery/Gallery.jsx"), "utf8");

test("the gallery asks the server for open items only", () => {
  assert.match(gallery, /listFoundItems\("open"\)/);
});

test("an open gallery refreshes itself: on a timer and when the student comes back to the app", () => {
  assert.match(gallery, /setInterval\(refresh, \d+\)/);
  assert.match(gallery, /addEventListener\("visibilitychange", refresh\)/);
  assert.match(gallery, /removeEventListener\("visibilitychange", refresh\)/); // and stops when the screen closes
  assert.match(gallery, /clearInterval\(timer\)/);
});

test("a background refresh is quiet: no loading text, and a failed refresh keeps what is on screen", () => {
  assert.match(gallery, /load\(\{ quiet: true \}\)/);
  assert.match(gallery, /if \(!quiet\) setLoading\(true\)/);
  assert.match(gallery, /if \(!quiet\) setError/);
});

// The gallery lists only items still waiting for their owner: once the owner confirms the return, the item leaves the
// gallery automatically (the server stops listing it; backend/test/school-journeys.test.js checks that). These tests
// guard the app side: the gallery asks only for open items, and a gallery that is already open refreshes itself, so a
// returned item disappears without the student having to leave the screen and come back.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const gallery = read("src/components/gallery/Gallery.jsx");

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

test('the section is called "Items found" wherever students see it (it used to be "Gallery")', () => {
  assert.match(read("src/components/layout/NavBar.jsx"), /label: "Items found"/);
  assert.match(gallery, /"Items found"/);
  for (const f of ["src/components/layout/NavBar.jsx", "src/components/found/FoundForm.jsx", "src/components/messages/ConversationList.jsx", "src/components/gallery/Gallery.jsx"]) {
    // visible text only: the internal screen name "gallery" (lower case) stays
    assert.doesNotMatch(read(f), /"[^"]*Gallery[^"]*"|>[^<{]*Gallery/, f);
  }
});

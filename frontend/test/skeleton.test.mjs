// Loading skeletons: while a screen waits for the server it shows soft shimmering shapes of what is coming (item cards,
// conversation rows, a chat, the token balance) instead of a bare "Loading...". These tests guard that no screen falls back
// to plain loading text, that screen readers still hear one status line, and that the shimmer stands still when the phone
// asks for less motion.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (f) => readFileSync(join(ROOT, f), "utf8");

function jsxFiles(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) return jsxFiles(rel);
    return rel.endsWith(".jsx") ? [rel] : [];
  });
}

test("no screen shows a bare Loading... line or a spinner while it waits", () => {
  for (const file of jsxFiles("src")) {
    const src = read(file);
    assert.doesNotMatch(src, />\s*Loading\.\.\.\s*</, `${file} still shows plain "Loading..." text`);
    assert.doesNotMatch(src, /\{error \|\| "Loading\.\.\."\}/, `${file} still shows plain "Loading..." text`);
    assert.doesNotMatch(src, /Loader2[^\n]*animate-spin/, `${file} still shows a spinner`);
  }
});

test("the main screens use skeletons shaped like what is coming", () => {
  assert.match(read("src/components/gallery/Gallery.jsx"), /<GridSkeleton/);
  assert.match(read("src/components/gallery/LostBoard.jsx"), /<ListSkeleton/);
  assert.match(read("src/components/messages/ConversationList.jsx"), /<ListSkeleton/);
  assert.match(read("src/components/tokens/TokensScreen.jsx"), /<TokensSkeleton/);
  assert.match(read("src/components/support/SupportScreen.jsx"), /<ChatSkeleton/);
  assert.match(read("src/components/auth/AuthGate.jsx"), /<AppSkeleton/);
});

test("screen readers hear one status line and not the shapes", () => {
  const sk = read("src/components/shared/Skeleton.jsx");
  assert.match(sk, /role="status"/);
  assert.match(sk, /<span className="sr-only">\{label\}<\/span>/);
  // the layout (gap, grid) goes on the box that holds the shapes, not on the status line around them
  assert.match(sk, /<div className=\{className \|\| undefined\} aria-hidden="true">\s*\{children\}\s*<\/div>/);
  assert.match(sk, /className=\{`fi-bone block \$\{className\}`\} aria-hidden="true"/);
});

test("bones take the student's own colours and only shimmer when the phone allows motion", () => {
  const css = read("src/index.css");
  assert.match(css, /\.fi-bone \{[^}]*rgb\(var\(--slate-700\)/);
  const shimmer = css.indexOf("animation: fi-shimmer");
  assert.ok(shimmer > 0);
  const media = css.lastIndexOf("@media (prefers-reduced-motion: no-preference)", shimmer);
  assert.ok(media > css.indexOf(".fi-bone::after {"), "the shimmer must sit inside the no-preference media query");
});

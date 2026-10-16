// Most students use FoundIT one-handed on a phone. These tests guard the things that make it comfortable there and that are easy to lose by
// accident: thumb-sized buttons, text boxes that do not make an iPhone zoom, room for the iPhone notch and home bar, solid top and bottom bars,
// and text that is not too small to read. (The real-browser audit at 320, 375 and 414 px is described in the README.)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const jsx = (dir = SRC, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) jsx(p, out);
    else if (e.name.endsWith(".jsx")) out.push(p);
  }
  return out;
};

test("the page may extend under the iPhone notch and home bar (viewport-fit=cover), and the bars make room for them", () => {
  assert.match(read("index.html"), /<meta name="viewport" content="[^"]*viewport-fit=cover/);
  assert.match(read("src/components/layout/Layout.jsx"), /paddingTop: "env\(safe-area-inset-top/);
  assert.match(read("src/components/layout/Layout.jsx"), /calc\(5rem \+ env\(safe-area-inset-bottom/);
  assert.match(read("src/components/layout/NavBar.jsx"), /paddingBottom: "env\(safe-area-inset-bottom/);
});

test("on a phone every button is at least 44px tall, an icon-only button at least 44px wide, and a text box is 16px", () => {
  const css = read("src/index.css");
  const block = css.slice(css.indexOf("@media (max-width: 767px), (pointer: coarse)"));
  assert.match(block, /button:not\(\[role="switch"\]\),\s*\[role="button"\]\s*\{\s*min-height:\s*44px/);
  assert.match(block, /button:not\(\[role="switch"\]\):has\(> svg:only-child\)\s*\{\s*min-width:\s*44px/);
  assert.match(block, /textarea\s*\{\s*font-size:\s*16px/, "16px stops iPhones zooming the page when a box is tapped");
  assert.match(block, /input:not\(\[type="checkbox"\]\)/, "check boxes and radio buttons keep their own size");
});

test("the top and bottom bars are solid, so scrolling content never shows through them", () => {
  for (const file of ["src/components/layout/Layout.jsx", "src/components/layout/NavBar.jsx"]) {
    assert.ok(!/bg-bar-(?:top|bottom)\/\d+/.test(read(file)), `${file}: a see-through bar`);
  }
});

test("no text is set smaller than 11px, and 11px only for the small count badge and the label pill", () => {
  const allowed11 = new Set(["components/layout/NavBar.jsx", "components/auth/AuthGate.jsx"]);
  const bad = [];
  for (const p of jsx()) {
    const rel = relative(SRC, p).replaceAll("\\", "/");
    const text = readFileSync(p, "utf8");
    if (/text-\[(?:[0-9]|10)px\]/.test(text)) bad.push(`${rel}: under 11px`);
    if (/text-\[11px\]/.test(text) && !allowed11.has(rel)) bad.push(`${rel}: 11px`);
  }
  assert.deepEqual(bad, []);
});

test("the show-password button is a real thumb-sized button with room for it inside the box", () => {
  const src = read("src/components/auth/PasswordInput.jsx");
  assert.match(src, /pr-12/, "text must not run underneath the button");
  assert.match(src, /aria-label=\{visible \? "Hide password" : "Show password"\}/);
});

test("every icon-only button has a name a screen reader can read", () => {
  const bad = [];
  for (const p of jsx()) {
    const text = readFileSync(p, "utf8");
    // <button ...>  <SomeIcon .../>  </button> with nothing else inside and no aria-label
    // (an attribute may contain "=>" of an arrow function, so that arrow must not end the tag)
    for (const m of text.matchAll(/<button\b((?:=>|[^>])*)>\s*<[A-Z][A-Za-z0-9]*\b(?:=>|[^>])*\/>\s*<\/button>/g)) {
      if (!/aria-label|title=/.test(m[1])) bad.push(`${relative(SRC, p).replaceAll("\\", "/")}: ${m[0].slice(0, 80).replace(/\s+/g, " ")}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("screen heights follow the visible screen (dvh), not the taller one an iPhone reports (vh)", () => {
  const bad = [];
  for (const p of jsx()) {
    const text = readFileSync(p, "utf8");
    if (/(?<![\w-])(?:min-h-screen|h-screen)(?=[\s"'`])|\[[^\]]*\dvh[^\]]*\]/.test(text) && !p.endsWith("Confetti.jsx")) bad.push(relative(SRC, p).replaceAll("\\", "/"));
  }
  assert.deepEqual(bad, [], "use min-h-app, max-h-sheet, max-h-half or h-chat (index.css): they use dvh");
  const css = read("src/index.css");
  for (const cls of ["min-h-app", "max-h-sheet", "max-h-half", "h-chat"]) {
    const block = css.slice(css.indexOf(`.${cls} {`), css.indexOf("}", css.indexOf(`.${cls} {`)));
    assert.match(block, /vh/, `${cls} keeps a vh fallback`);
    assert.match(block, /dvh/, `${cls} uses dvh`);
  }
  assert.match(css, /\.h-chat \{[^}]*safe-area-inset-bottom/, "the open chat leaves room for the iPhone home bar");
  assert.match(read("src/components/messages/ConversationView.jsx"), /className="flex h-chat flex-col"/);
});

test("every text box has a name: a label, or an aria-label where there is only a placeholder", () => {
  const bad = [];
  for (const p of jsx()) {
    const text = readFileSync(p, "utf8");
    for (const m of text.matchAll(/<input\b((?:=>|[^>])*?)\/?>/g)) {
      const attrs = m[1];
      if (/type="(?:hidden|checkbox|radio|file)"|aria-hidden="true"/.test(attrs)) continue; // (a bot-trap field is hidden from screen readers on purpose)
      if (!/aria-label|aria-labelledby|\bid=/.test(attrs)) bad.push(`${relative(SRC, p).replaceAll("\\", "/")}: ${attrs.trim().slice(0, 70).replace(/\s+/g, " ")}`);
    }
  }
  assert.deepEqual(bad, []);
});

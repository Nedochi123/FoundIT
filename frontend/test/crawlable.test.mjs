// Search engines (and slow connections) read the page's HTML before the app's JavaScript has run. These tests make sure that HTML
// says what FoundIT is, in plain text, and that the app still replaces it as soon as it starts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCHOOLS } from "../src/lib/schools.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const html = read("index.html");
const root = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<script type="module"/)?.[1] ?? "";
const text = root.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

test("the page says what FoundIT is before any JavaScript runs: one heading and real sentences inside #root", () => {
  assert.equal((root.match(/<h1\b/g) || []).length, 1, "exactly one main heading");
  assert.match(root, /<h1[^>]*>[^<]*FoundIT[^<]*lost and found/i);
  assert.ok(text.split(" ").length >= 60, "enough plain text for a search engine to understand the page");
  assert.match(text, /lost/i);
  assert.match(text, /found/i);
  for (const s of SCHOOLS.filter((x) => x.enabled)) assert.ok(text.includes(s.name), `the page names every open school: ${s.name}`);
});

test("the text is true to the app: only things FoundIT really has are promised", () => {
  const home = read("src/components/Home.jsx");
  assert.match(home, /I lost something/);
  assert.match(home, /I found something/);
  assert.ok(readFileSync(new URL("../src/components/tags/TagsScreen.jsx", import.meta.url), "utf8").length > 0, "QR tags screen exists");
  assert.match(text, /QR "Return me" tags/);
  assert.ok(!/paystack|buy|premium|subscription|per month/i.test(text), "no payment promises the app does not make");
});

test("the heading, description and page title agree about what the app is", () => {
  assert.match(html, /<title>FoundIT — Campus Lost &amp; Found<\/title>/, "the tab title fits every school");
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] || "";
  for (const s of SCHOOLS.filter((x) => x.enabled)) assert.ok(description.includes(s.name), `the description names ${s.name}`);
  for (const s of SCHOOLS.filter((x) => !x.enabled)) assert.ok(!html.includes(s.name), `a school that is not open is not advertised: ${s.name}`);
  assert.match(html, /<link rel="canonical" href="https:\/\/founditapp\.nedochipublications\.com\/" \/>/);
});

test("the app mounts into #root with createRoot, which replaces the text above", () => {
  const main = read("src/main.jsx");
  assert.match(main, /createRoot\(document\.getElementById\("root"\)\)\.render\(/);
});

test("search engines are allowed in and told where the sitemap is", () => {
  const robots = read("public/robots.txt");
  assert.match(robots, /User-agent: \*\s+Allow: \//);
  assert.ok(!/Disallow:\s*\/\s*$/m.test(robots), "the whole site is not blocked");
  assert.match(robots, /Sitemap: https:\/\/founditapp\.nedochipublications\.com\/sitemap\.xml/);
  assert.match(read("public/sitemap.xml"), /<loc>https:\/\/founditapp\.nedochipublications\.com\/<\/loc>/);
  assert.ok(!/noindex/i.test(html), "no noindex tag");
});

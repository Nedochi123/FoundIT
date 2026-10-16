// Checks that every color theme keeps text readable (WCAG contrast). Run with `npm run themes:check`.
// It exits with an error if a theme is worse than it should be, so a bad new theme is caught before it ships.
// Each text color is measured against the card color AND the darkest/lightest parts of the page gradient.
import { THEMES } from "../src/lib/themes.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "src", "themes.css"), "utf8");

const hex = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// a color (hex, rgba or transparent) laid over a solid one
const over = (color, solid) => {
  if (color.startsWith("#")) return hex(color);
  if (color === "transparent") return solid;
  const m = color.match(/[\d.]+/g).map(Number);
  if (m.length < 4) return m.slice(0, 3);
  return [0, 1, 2].map((i) => Math.round(m[i] * m[3] + solid[i] * (1 - m[3])));
};

function varsOf(id) {
  const block = css.match(new RegExp(`:root(?:,\\s*:root\\[data-theme="classic"\\])?${id === "classic" ? "" : `\\[data-theme="${id}"\\]`}\\s*\\{([^}]*)\\}`));
  const out = {};
  for (const m of block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const triplet = (s) => s.split(" ").map(Number);
const worst = (fg, surfaces) => Math.min(...surfaces.map((s) => ratio(fg, s)));

// semantic text colors the app uses on cards: [name, dark-theme color (Tailwind -400/-300), CSS variable on light themes]
const SEMANTIC = [
  ["error red", [248, 113, 113], "t-red"],
  ["warning amber", [252, 211, 77], "t-amber"],
  ["success green", [52, 211, 153], "t-emerald"],
];

let failed = false;
console.log("theme        | button text | accent text | heading | secondary | hint | error/warning/success text");
for (const t of THEMES) {
  const v = varsOf(t.id);
  const light = t.neutral?.tone === "light";
  const white = [255, 255, 255];
  const base = triplet(v["slate-950"]);
  const page = over(t.bg, base); // the one flat page color
  const surfaces = [triplet(v["slate-900"]), page];
  const rows = {
    button: ratio(white, triplet(v["brand-btn"])), // white text on the flat button fill
    accent: worst(triplet(v["brand-teal"]), surfaces),
    heading: worst(triplet(v["slate-50"]), surfaces),
    secondary: worst(triplet(v["slate-300"]), surfaces),
    hint: worst(triplet(v["slate-400"]), surfaces),
  };
  const semantic = SEMANTIC.map(([name, darkRgb, variable]) => [name, worst(v[variable] ? triplet(v[variable]) : darkRgb, surfaces)]);
  const need = 4.5;
  const bad = [...Object.entries(rows), ...semantic].filter(([, val]) => val < need).map(([k]) => k);
  const fmt = (n) => n.toFixed(1).padStart(4);
  console.log(
    `${t.id.padEnd(12)} | ${fmt(rows.button)}        | ${fmt(rows.accent)}        | ${fmt(rows.heading)}    | ${fmt(rows.secondary)}      | ${fmt(rows.hint)} | ${semantic.map(([, n]) => fmt(n)).join(" ")}${bad.length ? `   <-- below ${need}: ${bad.join(", ")}` : ""}`
  );
  // every look, the Default included, must reach WCAG AA for text
  if (bad.length) failed = true;
}
if (failed) {
  console.error("\nSome themes have text below the 4.5:1 contrast ratio. Adjust their colors in src/lib/themes.js.");
  process.exit(1);
}
console.log("\nAll themes keep text at 4.5:1 or better.");

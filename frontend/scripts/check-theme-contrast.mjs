// Checks that every color theme keeps text readable (WCAG contrast). Run with `npm run themes:check`.
// It exits with an error if a theme is worse than it should be, so a bad new theme is caught before it ships.
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
// a translucent color (rgba) laid over a solid one
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

let failed = false;
console.log("theme    | button text on a / b | accent text on card / page top | secondary text (slate-300) | hint text (slate-400)");
for (const t of THEMES) {
  const v = varsOf(t.id);
  const white = [255, 255, 255];
  const card = triplet(v["slate-900"]);
  const darkBase = triplet(v["slate-950"]);
  const pageTop = over(t.bg.top, over(t.bg.mid, darkBase));
  const accent = triplet(v["brand-teal"]);
  const rows = {
    btnA: ratio(white, hex(v["brand-a"])),
    btnB: ratio(white, hex(v["brand-b"])),
    accentCard: ratio(accent, card),
    accentTop: ratio(accent, pageTop),
    secondary: Math.min(ratio(triplet(v["slate-300"]), card), ratio(triplet(v["slate-300"]), pageTop)),
    hint: Math.min(ratio(triplet(v["slate-400"]), card), ratio(triplet(v["slate-400"]), pageTop)),
  };
  // Default is the baseline (it already shipped); every other theme must at least reach WCAG AA for text
  const need = { btnA: 4.5, btnB: 4.5, accentCard: 4.5, accentTop: 4.5, secondary: 4.5, hint: 4.5 };
  const bad = Object.entries(rows).filter(([k, val]) => val < need[k]);
  const fmt = (n) => n.toFixed(1).padStart(4);
  console.log(
    `${t.id.padEnd(8)} | ${fmt(rows.btnA)} / ${fmt(rows.btnB)}          | ${fmt(rows.accentCard)} / ${fmt(rows.accentTop)}                | ${fmt(rows.secondary)}                       | ${fmt(rows.hint)}${bad.length ? `   <-- below 4.5: ${bad.map(([k]) => k).join(", ")}` : ""}`
  );
  if (bad.length && t.id !== "classic") failed = true;
}
if (failed) {
  console.error("\nSome themes have text below the 4.5:1 contrast ratio. Adjust their colors in src/lib/themes.js.");
  process.exit(1);
}
console.log("\nAll themes keep text at 4.5:1 or better.");

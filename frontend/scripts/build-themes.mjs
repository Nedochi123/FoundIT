// Generates src/themes.css (one block of CSS variables per color theme) and public/themes/camo.svg from
// src/lib/themes.js. Run with `npm run themes`; it also runs automatically before `npm run build`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES } from "../src/lib/themes.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- colors ----
const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const triplet = (hex) => hexToRgb(hex).join(" ");
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

// Tailwind's own slate scale: [step, lightness %, saturation %] (hue ~ 215). Other themes reuse the lightness
// steps with their own hue and a scaled saturation, so contrast stays the same as the default.
const SLATE_HSL = [
  [50, 98, 40],
  [100, 96, 40],
  [200, 91, 32],
  [300, 84, 27],
  [400, 65, 20],
  [500, 47, 16],
  [600, 35, 19],
  [700, 27, 25],
  [800, 17, 33],
  [900, 11, 47],
  [950, 5, 84],
];
const SLATE_DEFAULT = {
  50: "248 250 252",
  100: "241 245 249",
  200: "226 232 240",
  300: "203 213 225",
  400: "148 163 184",
  500: "100 116 139",
  600: "71 85 105",
  700: "51 65 85",
  800: "30 41 59",
  900: "15 23 42",
  950: "2 6 23",
};

// A LIGHT theme flips the scale so the classes the app already uses keep working: text-slate-50 (headings) is
// now dark ink, bg-slate-900/70 (cards) is now a pale surface, border-slate-700 a soft line, and so on.
const SLATE_LIGHT_HSL = [
  [50, 13, 45],
  [100, 16, 45],
  [200, 20, 42],
  [300, 25, 38],
  [400, 34, 32],
  [500, 46, 28],
  [600, 66, 30],
  [700, 80, 42],
  [800, 91, 55],
  [900, 97, 70],
  [950, 99, 80],
];

function slateScale(neutral) {
  if (!neutral) return SLATE_DEFAULT;
  const table = neutral.tone === "light" ? SLATE_LIGHT_HSL : SLATE_HSL;
  return Object.fromEntries(
    table.map(([step, l, s]) => [step, hslToRgb(neutral.hue, Math.min(100, s * neutral.sat), l).join(" ")])
  );
}

// On a light theme, the pale shades of red/amber/green/etc. the app uses for TEXT (made for dark backgrounds)
// switch to these dark ones; tailwind.config.js reads them for text only, so buttons and tints are untouched.
const LIGHT_TEXT_COLORS = {
  red: "153 27 27",
  amber: "146 64 14",
  emerald: "6 95 70",
  cyan: "21 94 117",
  blue: "30 64 175",
};

function themeVars(t) {
  const lines = [];
  const slate = slateScale(t.neutral);
  for (const [step, rgb] of Object.entries(slate)) lines.push(`--slate-${step}: ${rgb};`);
  lines.push(`--brand-a: ${t.brand.a};`);
  lines.push(`--brand-b: ${t.brand.b};`);
  lines.push(`--brand-teal: ${triplet(t.brand.text)};`);
  lines.push(`--brand-blue: ${triplet(t.brand.shadow)};`);
  // a solid fill that white sits on (switch tracks): the accent text color is too pale for that on most themes
  lines.push(`--brand-solid: ${triplet(t.brand.solid || t.brand.a)};`);
const light = t.neutral?.tone === "light";
  const bar = t.bar || {
    top: hslToRgb(t.neutral.hue, Math.min(100, (light ? 70 : 44) * t.neutral.sat), light ? 98 : 4).join(" "),
    bottom: hslToRgb(t.neutral.hue, Math.min(100, (light ? 70 : 44) * t.neutral.sat), light ? 96 : 7.5).join(" "),
  };
  lines.push(`--bar-top: ${bar.top};`);
  lines.push(`--bar-bottom: ${bar.bottom};`);
  lines.push(`--logo-check: ${t.logoCheck || "#3fe08b"};`); // the check mark inside the icon
  lines.push(`--bg-top: ${t.bg.top};`);
  lines.push(`--bg-mid: ${t.bg.mid};`);
  lines.push(`--bg-bottom: ${t.bg.bottom};`);
  lines.push(`--glow-one: ${t.glow.one};`);
  lines.push(`--glow-two: ${t.glow.two};`);
  lines.push(`--blob-one: ${t.blobs.one};`);
  lines.push(`--blob-two: ${t.blobs.two};`);
  lines.push(`--doodle: ${t.doodle};`);
  // the page's default text color (what text with no color class of its own gets)
  lines.push(`--body-text: ${light ? slate[100] : "229 231 235"};`);
  if (light) {
    lines.push("color-scheme: light;");
    // white borders/tints (made for dark backgrounds) become ink-colored ones
    lines.push(`--overlay: ${slate[50]};`);
    // the big gold gradient number on the Tokens screen, deep amber so it reads on a pale page
    lines.push("--tokens-from: 180 83 9;");
    lines.push("--tokens-to: 146 64 14;");
    for (const [family, rgb] of Object.entries(LIGHT_TEXT_COLORS)) lines.push(`--t-${family}: ${rgb};`);
  } else {
    // a dark theme can lighten a status text color where its backgrounds need it (see textColors in themes.js)
    for (const [family, rgb] of Object.entries(t.textColors || {})) lines.push(`--t-${family}: ${rgb};`);
  }
  lines.push(`--bg-pattern: ${t.pattern ? `url(${t.pattern.file})` : "none"};`);
  lines.push(`--bg-pattern-size: ${t.pattern ? t.pattern.size : "auto"};`);
  return lines.map((l) => `  ${l}`).join("\n");
}

let css = `/* GENERATED by scripts/build-themes.mjs from src/lib/themes.js. Do not edit by hand: run \`npm run themes\`. */\n`;
for (const t of THEMES) {
  const selector = t.id === "classic" ? `:root,\n:root[data-theme="classic"]` : `:root[data-theme="${t.id}"]`;
  css += `\n/* ${t.label} */\n${selector} {\n${themeVars(t)}\n}\n`;
}
fs.writeFileSync(path.join(root, "src", "themes.css"), css);

// ---- camouflage tile (seamless: blobs near an edge are drawn again on the opposite side) ----
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TILE = 420;
function blobPath(cx, cy, rx, ry, rot, rand) {
  const n = 9;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 0.7 + rand() * 0.55;
    const x = Math.cos(a) * rx * j;
    const y = Math.sin(a) * ry * j;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  // closed Catmull-Rom spline -> cubic Beziers
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}
function camoSvg() {
  const rand = mulberry32(20261009);
  const layers = [
    { color: "#3b4721", count: 7 },
    { color: "#4a3a22", count: 6 },
    { color: "#1c2210", count: 7 },
    { color: "#0e1108", count: 5 },
  ];
  let shapes = "";
  for (const { color, count } of layers) {
    let group = "";
    for (let i = 0; i < count; i++) {
      const cx = rand() * TILE;
      const cy = rand() * TILE;
      const rx = 55 + rand() * 50;
      const ry = 28 + rand() * 28;
      const rot = rand() * Math.PI;
      const reach = rx * 1.3;
      for (const dx of [-TILE, 0, TILE]) {
        for (const dy of [-TILE, 0, TILE]) {
          const x = cx + dx;
          const y = cy + dy;
          if (x + reach < 0 || x - reach > TILE || y + reach < 0 || y - reach > TILE) continue;
          // a fresh random stream per copy would change the shape, so rebuild with the same seed
          const copyRand = mulberry32(Math.floor(cx * 1000 + cy * 7 + i));
          group += `<path d="${blobPath(x, y, rx, ry, rot, copyRand)}"/>`;
        }
      }
    }
    shapes += `<g fill="${color}">${group}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}"><rect width="${TILE}" height="${TILE}" fill="#2a3118"/>${shapes}</svg>\n`;
}
fs.mkdirSync(path.join(root, "public", "themes"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "themes", "camo.svg"), camoSvg());

console.log(`themes: wrote src/themes.css (${THEMES.length} themes) and public/themes/camo.svg`);

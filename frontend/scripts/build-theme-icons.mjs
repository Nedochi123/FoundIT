// Generates the FoundIT app icon in every color theme, plus one web-app manifest per theme that points at them:
//   public/icons/themes/<theme>-<size>.png and public/icons/themes/<theme>-512-maskable.png
//   public/manifests/<theme>.json
// Run with `npm run themes:icons` after adding or recoloring a theme, and commit the result (like themes.css).
//
// Why: a phone reads the Home Screen icon from the manifest the page points at. index.html and
// lib/themedIcon.js point it at the student's own theme's manifest, so Chrome on Android (which re-checks the
// manifest of an installed app) updates the Home Screen icon to the saved color. The artwork is the same as
// public/icons/icon-*.png and components/theme/Logo.jsx: a rounded square in the theme's two brand colors with a
// magnifier and a check mark. "classic" (Default) keeps the original files and public/manifest.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { THEMES, DEFAULT_THEME } from "../src/lib/themes.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons", "themes");
const manifestsDir = path.join(root, "public", "manifests");
const SIZES = [192, 256, 384, 512];
const DEFAULT_CHECK = "#3fe08b"; // the check mark's usual color; a theme may override it with logoCheck

// The artwork on a 360 x 360 grid. `maskable` fills the whole square (the phone cuts its own shape) and keeps
// the drawing inside the middle, where nothing is cropped.
function svg({ a, b, check }, size, maskable) {
  const scale = maskable ? 0.62 : 1;
  const shift = (360 - 360 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 360 360">
  <defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="360" y2="360"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="360" height="360" rx="${maskable ? 0 : 62}" fill="url(#g)"/>
  <g transform="translate(${shift} ${shift}) scale(${scale})" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#ffffff" stroke-width="24"><circle cx="150" cy="150" r="66"/><path d="M199 199L234 234"/></g>
    <path d="M108 152L136 176L186 124" stroke="${check}" stroke-width="19"/>
  </g>
</svg>`;
}

const base = JSON.parse(fs.readFileSync(path.join(root, "public", "manifest.json"), "utf8"));
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(manifestsDir, { recursive: true });

for (const t of THEMES) {
  if (t.id === DEFAULT_THEME) continue;
  const colors = { a: t.brand.a, b: t.brand.b, check: t.logoCheck || DEFAULT_CHECK };
  const icons = [];
  for (const size of SIZES) {
    await sharp(Buffer.from(svg(colors, size, false))).png().toFile(path.join(iconsDir, `${t.id}-${size}.png`));
    icons.push({ src: `/icons/themes/${t.id}-${size}.png`, sizes: `${size}x${size}`, type: "image/png" });
  }
  await sharp(Buffer.from(svg(colors, 512, true))).png().toFile(path.join(iconsDir, `${t.id}-512-maskable.png`));
  icons.push({ src: `/icons/themes/${t.id}-512-maskable.png`, sizes: "512x512", type: "image/png", purpose: "maskable" });

  // Same app as public/manifest.json (same address, scope and name) with this color's icons and bar color.
  const manifest = { ...base, theme_color: t.chrome, icons };
  fs.writeFileSync(path.join(manifestsDir, `${t.id}.json`), JSON.stringify(manifest, null, 2) + "\n");
}
console.log(`theme icons: wrote ${(THEMES.length - 1) * (SIZES.length + 1)} icons and ${THEMES.length - 1} manifests`);

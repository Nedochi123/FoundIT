// The looks a student can pick: an app color (THEMES) and a style of floating doodles (DOODLES).
// The ids must match backend/src/utils/themes.js. The CSS for each color is GENERATED from this file:
// run `npm run themes` (it also runs before every build) to rewrite src/themes.css and public/themes/camo.svg.
//
// Most themes are dark (light text on dark cards); a theme with neutral.tone "light" is a real light mode: the
// grey "slate" scale is flipped (headings become dark ink, cards become pale), white borders turn to ink, and
// the red/amber/green text colors switch to darker shades so everything stays readable. A theme recolors the
// whole app through CSS variables:
//  - neutral: { hue, sat, tone? } tints the grey "slate" scale used by cards, borders and text (sat 1 ~ the
//    default navy; near 0 = plain grey). null keeps Tailwind's own slate exactly (the default look).
//  - brand: the gradient on buttons (a -> b, kept dark enough for white text), the accent text color, and the
//    glow color under buttons.
//  - bg: the page background (top, middle, bottom of the gradient); glow/blobs: soft colored light on it.
//  - doodle: the color of the floating doodles.
//  - intro: the colors of the one-time welcome animation (a dark stage, a glow behind it, and a glow around the logo).

export const DEFAULT_THEME = "classic";
export const DEFAULT_DOODLE = "none";

export const DOODLES = [
  { id: "none", label: "None" },
  { id: "kittens", label: "Kittens" },
  { id: "dogs", label: "Dogs" },
  { id: "aliens", label: "Aliens" },
  { id: "money", label: "Money" },
  { id: "science", label: "Microscopes" },
];

export const THEMES = [
  {
    id: "classic",
    chrome: "#0a0e1a", // the browser/phone status-bar color
    label: "Default",
    intro: { top: "#1c2b52", mid: "#0d1326", bottom: "#05070d", glowOne: "#2f4bb3", glowTwo: "#4c3a8f", shadowOne: "29 78 216", shadowTwo: "59 96 230" },
    suggestedDoodle: "none",
    neutral: null,
    brand: { a: "#17b8ae", b: "#2467e6", text: "#119aa0", shadow: "#2467e6", solid: "#119aa0" },
    bg: { top: "#182544", mid: "#0a0e1a", bottom: "#05070d" },
    bar: { top: "5 7 13", bottom: "10 14 26" },
    // none: today's page has only the gradient (+ the two soft blobs), and Default must look exactly like it
    glow: { one: "transparent", two: "transparent" },
    blobs: { one: "#17b8ae", two: "#2467e6" },
    doodle: "#5eead4",
    swatchBg: "linear-gradient(135deg, #182544, #05070d)",
  },
  {
    id: "pink",
    chrome: "#1c0c18", // the browser/phone status-bar color
    label: "Pink",
    textColors: { red: "252 165 165" }, // a lighter error red: this theme's page is a little lighter than most
    intro: { top: "#5a1744", mid: "#2a0b22", bottom: "#12050f", glowOne: "#c0267a", glowTwo: "#7a2fb0", shadowOne: "219 39 119", shadowTwo: "236 72 153" },
    suggestedDoodle: "kittens",
    neutral: { hue: 322, sat: 0.9 },
    brand: { a: "#db2777", b: "#9333ea", text: "#f9a8d4", shadow: "#db2777" },
    bg: { top: "#5e1946", mid: "#34102c", bottom: "#1b0716" },
    glow: { one: "rgba(244, 114, 182, 0.22)", two: "rgba(217, 70, 239, 0.16)" },
    blobs: { one: "#ec4899", two: "#a855f7" },
    doodle: "#fbcfe8",
    swatchBg: "linear-gradient(135deg, #8a2468, #230a1c)",
  },
  {
    id: "camo",
    chrome: "#10140a", // the browser/phone status-bar color
    label: "Camo",
    logoCheck: "#ecfccb", // paler than the usual mint, so it shows on the olive icon
    intro: { top: "#2f3a1a", mid: "#151a0b", bottom: "#080a05", glowOne: "#5a7f1a", glowTwo: "#8a4a14", shadowOne: "77 124 15", shadowTwo: "146 64 14" },
    suggestedDoodle: "dogs",
    neutral: { hue: 82, sat: 0.5 },
    brand: { a: "#4d7c0f", b: "#92400e", text: "#bef264", shadow: "#4d7c0f" },
    // translucent so the camouflage pattern shows through, darker toward the bottom for readability
    bg: { top: "rgba(40, 50, 22, 0.40)", mid: "rgba(16, 20, 9, 0.68)", bottom: "rgba(8, 10, 5, 0.86)" },
    glow: { one: "rgba(190, 242, 100, 0.05)", two: "rgba(146, 64, 14, 0.10)" },
    blobs: { one: "#4d7c0f", two: "#92400e" },
    doodle: "#d9e8a0",
    pattern: { file: "/themes/camo.svg", size: "420px" },
    swatchBg: "url(/themes/camo.svg) center / 120px",
  },
  {
    id: "black",
    chrome: "#09090b", // the browser/phone status-bar color
    label: "Black",
    logoCheck: "#d1fae5",
    intro: { top: "#17171c", mid: "#09090b", bottom: "#000000", glowOne: "#0f6b45", glowTwo: "#0c5a6e", shadowOne: "4 120 87", shadowTwo: "16 185 129" },
    suggestedDoodle: "aliens",
    neutral: { hue: 240, sat: 0.07 },
    brand: { a: "#047857", b: "#0f766e", text: "#4ade80", shadow: "#10b981" },
    bg: { top: "#141417", mid: "#09090b", bottom: "#000000" },
    glow: { one: "rgba(74, 222, 128, 0.035)", two: "rgba(56, 189, 248, 0.03)" },
    blobs: { one: "#14532d", two: "#0c4a6e" },
    doodle: "#86efac",
    swatchBg: "linear-gradient(135deg, #1f1f24, #000000)",
  },
  {
    id: "blue",
    chrome: "#06263b", // the browser/phone status-bar color
    label: "Blue",
    textColors: { red: "252 165 165" },
    intro: { top: "#0f4c78", mid: "#08304f", bottom: "#04192a", glowOne: "#1e6fd0", glowTwo: "#3b3fb8", shadowOne: "3 105 161", shadowTwo: "56 189 248" },
    suggestedDoodle: "science",
    neutral: { hue: 203, sat: 1.15 },
    brand: { a: "#0369a1", b: "#4338ca", text: "#7dd3fc", shadow: "#0284c7" },
    bg: { top: "#0a3f60", mid: "#082f49", bottom: "#04192a" },
    glow: { one: "rgba(56, 189, 248, 0.20)", two: "rgba(99, 102, 241, 0.16)" },
    blobs: { one: "#38bdf8", two: "#6366f1" },
    doodle: "#bae6fd",
    swatchBg: "linear-gradient(135deg, #0b5078, #04192a)",
  },
  {
    id: "red",
    chrome: "#1d0709", // the browser/phone status-bar color
    label: "Red",
    intro: { top: "#5a1420", mid: "#2a0a10", bottom: "#130406", glowOne: "#c0262d", glowTwo: "#c25a14", shadowOne: "220 38 38", shadowTwo: "249 115 22" },
    suggestedDoodle: "money",
    neutral: { hue: 352, sat: 0.95 },
    brand: { a: "#dc2626", b: "#9f1239", text: "#fda4af", shadow: "#dc2626" },
    bg: { top: "#4c0f1a", mid: "#26080d", bottom: "#130406" },
    glow: { one: "rgba(239, 68, 68, 0.18)", two: "rgba(249, 115, 22, 0.12)" },
    blobs: { one: "#ef4444", two: "#f97316" },
    doodle: "#fecaca",
    swatchBg: "linear-gradient(135deg, #5c1220, #170507)",
  },
  {
    id: "purple",
    chrome: "#120830", // the browser/phone status-bar color
    label: "Purple",
    intro: { top: "#3a1a78", mid: "#1a0c3d", bottom: "#0a0520", glowOne: "#6a3bd6", glowTwo: "#b13a9a", shadowOne: "124 58 237", shadowTwo: "167 139 250" },
    suggestedDoodle: "aliens",
    neutral: { hue: 268, sat: 0.85 },
    brand: { a: "#7c3aed", b: "#4f46e5", text: "#c4b5fd", shadow: "#7c3aed" },
    bg: { top: "#2e1065", mid: "#170a38", bottom: "#0a0520" },
    glow: { one: "rgba(167, 139, 250, 0.18)", two: "rgba(236, 72, 153, 0.12)" },
    blobs: { one: "#8b5cf6", two: "#ec4899" },
    doodle: "#ddd6fe",
    swatchBg: "linear-gradient(135deg, #3b1685, #0c0624)",
  },
  {
    id: "green",
    chrome: "#031c15", // the browser/phone status-bar color
    label: "Green",
    textColors: { red: "252 165 165" },
    logoCheck: "#d1fae5",
    intro: { top: "#07503c", mid: "#04281e", bottom: "#02120d", glowOne: "#14804a", glowTwo: "#2a8a2e", shadowOne: "21 128 61", shadowTwo: "52 211 153" },
    suggestedDoodle: "money",
    neutral: { hue: 152, sat: 0.8 },
    brand: { a: "#15803d", b: "#0f766e", text: "#86efac", shadow: "#16a34a" },
    bg: { top: "#054232", mid: "#04261d", bottom: "#02120d" },
    glow: { one: "rgba(52, 211, 153, 0.16)", two: "rgba(132, 204, 22, 0.10)" },
    blobs: { one: "#10b981", two: "#84cc16" },
    doodle: "#bbf7d0",
    swatchBg: "linear-gradient(135deg, #07604a, #02120d)",
  },
  {
    id: "lightpink",
    chrome: "#fde2ef",
    label: "Light pink",
    intro: { top: "#6b1d52", mid: "#34102c", bottom: "#1b0716", glowOne: "#db2777", glowTwo: "#9333ea", shadowOne: "219 39 119", shadowTwo: "244 114 182" },
    suggestedDoodle: "kittens",
    neutral: { hue: 330, sat: 1, tone: "light" },
    brand: { a: "#db2777", b: "#9333ea", text: "#9d174d", shadow: "#db2777" },
    bg: { top: "#fff3f9", mid: "#fddcec", bottom: "#f8c8de" },
    glow: { one: "rgba(236, 72, 153, 0.18)", two: "rgba(217, 70, 239, 0.12)" },
    blobs: { one: "#f472b6", two: "#c084fc" },
    doodle: "#db2777",
    swatchBg: "linear-gradient(135deg, #fff3f9, #f8c8de)",
  },
  {
    id: "lightpurple",
    chrome: "#ece2fd",
    label: "Light purple",
    intro: { top: "#3d2380", mid: "#1c0f45", bottom: "#0c0624", glowOne: "#7c3aed", glowTwo: "#4f46e5", shadowOne: "124 58 237", shadowTwo: "167 139 250" },
    suggestedDoodle: "science",
    neutral: { hue: 262, sat: 1, tone: "light" },
    brand: { a: "#7c3aed", b: "#4f46e5", text: "#5b21b6", shadow: "#7c3aed" },
    bg: { top: "#f8f3ff", mid: "#e8dcfc", bottom: "#d8c8f7" },
    glow: { one: "rgba(139, 92, 246, 0.18)", two: "rgba(236, 72, 153, 0.10)" },
    blobs: { one: "#a78bfa", two: "#f0abfc" },
    doodle: "#7c3aed",
    swatchBg: "linear-gradient(135deg, #f8f3ff, #d8c8f7)",
  },
  // A school's own colors (school: only that school's students are offered it; see lib/schools.js).
  {
    id: "baze",
    school: "baze",
    // Baze: the charcoal-and-blue look he first saw, with more grey "in the right places" (his words). Grey is the
    // structure: the page, the cards and the grey half of the button and logo, all Baze's crest and website greys.
    // Blue (from Baze's banner photos) is kept only where it says "tap here": the other half of the button, and links.
    // The contrast rules are checked in test/schools.test.mjs.
    chrome: "#1e1f23", // the browser/phone status-bar color
    label: "Baze",
    logoCheck: "#dbeafe",
    intro: { top: "#2b2c31", mid: "#1e1f23", bottom: "#121316", glowOne: "#63656a", glowTwo: "#1d4ed8", shadowOne: "99 101 106", shadowTwo: "37 99 235" },
    suggestedDoodle: "none",
    neutral: { hue: 228, sat: 0.05 },
    brand: { a: "#6b6d73", b: "#2563eb", text: "#93c5fd", shadow: "#2563eb" },
    bg: { top: "#2b2c31", mid: "#1e1f23", bottom: "#121316" },
    glow: { one: "rgba(156, 159, 166, 0.07)", two: "rgba(156, 159, 166, 0.04)" },
    blobs: { one: "#63656a", two: "#4b4d53" }, // grey glows: the page itself stays grey
    doodle: "#9c9fa6",
    swatchBg: "linear-gradient(135deg, #3a3b40, #121316)",
  },
  {
    id: "cosmopolitan",
    school: "cosmopolitan",
    // Cosmopolitan University as its student ID card looks (he sent a photo: "how their color is"): a white card with a
    // royal navy band, a thin gold line and the navy-and-gold seal. So a LIGHT look: white-to-pale-navy page, royal navy
    // buttons and links (white text on them), gold as the accent (the check mark in the logo, the glows). Contrast rules:
    // test/schools.test.mjs and npm run themes:check.
    chrome: "#e8ecf5", // the browser/phone status-bar color
    label: "Cosmopolitan",
    logoCheck: "#e0b955", // the check mark in the navy logo tile: the card's gold
    intro: { top: "#24458a", mid: "#16295a", bottom: "#0a1430", glowOne: "#2f55a4", glowTwo: "#c9a24a", shadowOne: "31 61 122", shadowTwo: "201 162 74" },
    suggestedDoodle: "none",
    neutral: { hue: 222, sat: 1, tone: "light" },
    brand: { a: "#1f3d7a", b: "#2b4c8c", text: "#1f3d7a", shadow: "#1f3d7a" },
    bg: { top: "#ffffff", mid: "#f1f3f8", bottom: "#dfe5f1" },
    glow: { one: "rgba(201, 162, 74, 0.16)", two: "rgba(31, 61, 122, 0.10)" },
    blobs: { one: "#d9b968", two: "#7f97c9" },
    doodle: "#1f3d7a",
    swatchBg: "linear-gradient(160deg, #ffffff 58%, #c9a24a 58%, #c9a24a 62%, #1f3d7a 62%)",
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const DOODLE_IDS = DOODLES.map((d) => d.id);

export const getTheme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
export const normalizeLook = (look) => ({
  theme: THEME_IDS.includes(look?.theme) ? look.theme : DEFAULT_THEME,
  doodle: DOODLE_IDS.includes(look?.doodle) ? look.doodle : DEFAULT_DOODLE,
});

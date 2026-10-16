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
//  - brand: the flat fill of buttons (a if white text reads on it at 4.5:1, otherwise b; the generator picks, and
//    `npm run themes:check` verifies) and the accent text color. No gradients and no glows: the look is flat on purpose.
//  - bg: the one flat page color (the camo theme's is translucent so its pattern shows through).
//  - doodle: the color of the floating doodles.
//  - intro: the one flat color behind the one-time welcome animation.

export const DEFAULT_THEME = "classic";
export const DEFAULT_DOODLE = "none";

// WCAG contrast ratio between two colors given as "#rrggbb"
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = channels(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrast = (x, y) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

/** The flat fill of this look's buttons: its first brand color if white text reads on it at 4.5:1 (WCAG AA), else its second. */
export const buttonColor = (theme) => (contrast("#ffffff", theme.brand.a) >= 4.5 ? theme.brand.a : theme.brand.b);

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
    intro: "#0d1326",
    suggestedDoodle: "none",
    neutral: null,
    brand: { a: "#17b8ae", b: "#2467e6", text: "#119aa0", shadow: "#2467e6", solid: "#119aa0" },
    bg: "#0a0e1a",
    bar: { top: "5 7 13", bottom: "10 14 26" },
    doodle: "#5eead4",
    swatchBg: "linear-gradient(135deg, #182544, #05070d)",
  },
  {
    id: "pink",
    chrome: "#1c0c18", // the browser/phone status-bar color
    label: "Pink",
    textColors: { red: "252 165 165" }, // a lighter error red: this theme's page is a little lighter than most
    intro: "#2a0b22",
    suggestedDoodle: "kittens",
    neutral: { hue: 322, sat: 0.9 },
    brand: { a: "#db2777", b: "#9333ea", text: "#f9a8d4", shadow: "#db2777" },
    bg: "#34102c",
    doodle: "#fbcfe8",
    swatchBg: "linear-gradient(135deg, #8a2468, #230a1c)",
  },
  {
    id: "camo",
    chrome: "#10140a", // the browser/phone status-bar color
    label: "Camo",
    logoCheck: "#ecfccb", // paler than the usual mint, so it shows on the olive icon
    intro: "#151a0b",
    suggestedDoodle: "dogs",
    neutral: { hue: 82, sat: 0.5 },
    brand: { a: "#4d7c0f", b: "#92400e", text: "#bef264", shadow: "#4d7c0f" },
    // translucent so the camouflage pattern shows through, darker toward the bottom for readability
    bg: "rgba(16, 20, 9, 0.68)",
    doodle: "#d9e8a0",
    pattern: { file: "/themes/camo.svg", size: "420px" },
    swatchBg: "url(/themes/camo.svg) center / 120px",
  },
  {
    id: "black",
    chrome: "#09090b", // the browser/phone status-bar color
    label: "Black",
    logoCheck: "#d1fae5",
    intro: "#09090b",
    suggestedDoodle: "aliens",
    neutral: { hue: 240, sat: 0.07 },
    brand: { a: "#047857", b: "#0f766e", text: "#4ade80", shadow: "#10b981" },
    bg: "#09090b",
    doodle: "#86efac",
    swatchBg: "linear-gradient(135deg, #1f1f24, #000000)",
  },
  {
    id: "blue",
    chrome: "#06263b", // the browser/phone status-bar color
    label: "Blue",
    textColors: { red: "252 165 165" },
    intro: "#08304f",
    suggestedDoodle: "science",
    neutral: { hue: 203, sat: 1.15 },
    brand: { a: "#0369a1", b: "#4338ca", text: "#7dd3fc", shadow: "#0284c7" },
    bg: "#082f49",
    doodle: "#bae6fd",
    swatchBg: "linear-gradient(135deg, #0b5078, #04192a)",
  },
  {
    id: "red",
    chrome: "#1d0709", // the browser/phone status-bar color
    label: "Red",
    intro: "#2a0a10",
    suggestedDoodle: "money",
    neutral: { hue: 352, sat: 0.95 },
    brand: { a: "#dc2626", b: "#9f1239", text: "#fda4af", shadow: "#dc2626" },
    bg: "#26080d",
    doodle: "#fecaca",
    swatchBg: "linear-gradient(135deg, #5c1220, #170507)",
  },
  {
    id: "purple",
    chrome: "#120830", // the browser/phone status-bar color
    label: "Purple",
    intro: "#1a0c3d",
    suggestedDoodle: "aliens",
    neutral: { hue: 268, sat: 0.85 },
    brand: { a: "#7c3aed", b: "#4f46e5", text: "#c4b5fd", shadow: "#7c3aed" },
    bg: "#170a38",
    doodle: "#ddd6fe",
    swatchBg: "linear-gradient(135deg, #3b1685, #0c0624)",
  },
  {
    id: "green",
    chrome: "#031c15", // the browser/phone status-bar color
    label: "Green",
    textColors: { red: "252 165 165" },
    logoCheck: "#d1fae5",
    intro: "#04281e",
    suggestedDoodle: "money",
    neutral: { hue: 152, sat: 0.8 },
    brand: { a: "#15803d", b: "#0f766e", text: "#86efac", shadow: "#16a34a" },
    bg: "#04261d",
    doodle: "#bbf7d0",
    swatchBg: "linear-gradient(135deg, #07604a, #02120d)",
  },
  {
    id: "lightpink",
    chrome: "#fde2ef",
    label: "Light pink",
    intro: "#34102c",
    suggestedDoodle: "kittens",
    neutral: { hue: 330, sat: 1, tone: "light" },
    brand: { a: "#db2777", b: "#9333ea", text: "#9d174d", shadow: "#db2777" },
    bg: "#fddcec",
    doodle: "#db2777",
    swatchBg: "linear-gradient(135deg, #fff3f9, #f8c8de)",
  },
  {
    id: "lightpurple",
    chrome: "#ece2fd",
    label: "Light purple",
    intro: "#1c0f45",
    suggestedDoodle: "science",
    neutral: { hue: 262, sat: 1, tone: "light" },
    brand: { a: "#7c3aed", b: "#4f46e5", text: "#5b21b6", shadow: "#7c3aed" },
    bg: "#e8dcfc",
    doodle: "#7c3aed",
    swatchBg: "linear-gradient(135deg, #f8f3ff, #d8c8f7)",
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const DOODLE_IDS = DOODLES.map((d) => d.id);

export const getTheme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
export const normalizeLook = (look) => ({
  theme: THEME_IDS.includes(look?.theme) ? look.theme : DEFAULT_THEME,
  doodle: DOODLE_IDS.includes(look?.doodle) ? look.doodle : DEFAULT_DOODLE,
});

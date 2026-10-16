import colors from "tailwindcss/colors";

// Colors that change with the student's chosen look come from CSS variables (see src/themes.css, generated
// from src/lib/themes.js). The dark looks' values are exactly Tailwind's own slate/red/amber/... and the
// original brand colors, so nothing changes for anyone on those.
const rgbVar = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const SLATE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const triplet = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
const alphaOf = ({ opacityVariable, opacityValue }) =>
  opacityValue !== undefined ? opacityValue : opacityVariable ? `var(${opacityVariable}, 1)` : "1";

// A pale shade the app uses as TEXT on dark backgrounds (text-red-400, text-amber-300...). On a light theme
// --t-<family> holds a dark shade of the same hue; used as a background, border or tint it never changes.
const textAware = (family, shade) => (opts) => {
  const base = triplet(colors[family][shade]);
  const a = alphaOf(opts);
  return opts.opacityVariable === "--tw-text-opacity" ? `rgb(var(--t-${family}, ${base}) / ${a})` : `rgb(${base} / ${a})`;
};
const textAwareShades = (family, shades) =>
  Object.fromEntries(shades.map((shade) => [shade, textAware(family, shade)]));

// White with an opacity (border-white/10, bg-white/[0.04]...) is a faint highlight on a dark theme; on a light
// theme it would vanish, so there it becomes the theme's ink color. Plain white (text-white, bg-white) stays white.
const white = (opts) => {
  const a = alphaOf(opts);
  // a real opacity modifier (/10, /[0.04]) is a plain number; plain bg-white / ring-white arrive as a var(...) reference
  const faint = opts.opacityValue !== undefined && !String(opts.opacityValue).startsWith("var(") && opts.opacityVariable !== "--tw-text-opacity";
  return faint ? `rgb(var(--overlay, 255 255 255) / ${a})` : `rgb(255 255 255 / ${a})`;
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        white,
        slate: Object.fromEntries(SLATE_STEPS.map((step) => [step, rgbVar(`slate-${step}`)])),
        red: textAwareShades("red", [200, 300, 400]),
        amber: textAwareShades("amber", [200, 300, 400]),
        emerald: textAwareShades("emerald", [300, 400]),
        cyan: textAwareShades("cyan", [100, 200]),
        blue: textAwareShades("blue", [300]),
        brand: {
          teal: rgbVar("brand-teal"),
          blue: rgbVar("brand-blue"),
          solid: rgbVar("brand-solid"),
        },
        // the translucent top bar and bottom navigation
        bar: {
          top: rgbVar("bar-top"),
          bottom: rgbVar("bar-bottom"),
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, var(--brand-a) 0%, var(--brand-b) 100%)",
      },
    },
  },
  plugins: [],
};

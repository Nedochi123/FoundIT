// Colors that change with the student's chosen look come from CSS variables (see src/themes.css, generated
// from src/lib/themes.js). The default look's values are exactly Tailwind's own slate and the original brand
// colors, so nothing changes for anyone who keeps the default.
const rgbVar = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const SLATE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        slate: Object.fromEntries(SLATE_STEPS.map((step) => [step, rgbVar(`slate-${step}`)])),
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

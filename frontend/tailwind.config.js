/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          teal: "#119aa0",
          blue: "#2467e6",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #17b8ae 0%, #2467e6 100%)",
      },
    },
  },
  plugins: [],
};

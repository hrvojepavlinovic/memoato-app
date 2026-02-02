import { resolveProjectPath } from "wasp/dev";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [resolveProjectPath("./src/**/*.{js,jsx,ts,tsx}")],
  theme: {
    extend: {
      fontSize: {
        "tiny": ["0.625rem", "1rem"], // 10px
      },
      colors: {
        // Brand: monochrome (black/white)
        primary: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#18181B",
          600: "#111113",
          700: "#0B0B0C",
          800: "#070708",
          900: "#030303",
          950: "#000000",
        },
      },
    },
  },
  plugins: [],
};

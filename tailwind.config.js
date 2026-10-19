import { resolveProjectPath } from "wasp/dev";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [resolveProjectPath("./src/**/*.{js,jsx,ts,tsx}")],
  theme: {
    extend: {
      fontSize: {
        tiny: ["0.625rem", "1rem"], // 10px
      },
      colors: {
        neutral: {
          50: "#fbf9f4",
          100: "#eee9df",
          200: "#e1dbce",
          300: "#cbc7bb",
          400: "#999a8f",
          500: "#707468",
          600: "#555d51",
          700: "#3d483d",
          800: "#2a342b",
          900: "#1f2921",
          950: "#171e19",
        },
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

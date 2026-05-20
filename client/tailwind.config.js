/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        '3xl': '1920px',
      },
      colors: {
        secondary: "#f59e0b",
        gold: "#C8872A",
        "gold-light": "#E5A84B",
        "gold-dark": "#A0671A",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "Georgia", "serif"],
        body: ["DM Sans", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg:      "16px",
        full:    "9999px",
      },
      fontSize: {
        section:    ["clamp(1.5rem, 4vw, 4.5rem)", { lineHeight: "1.2" }],
        "section-h3": ["clamp(1.4rem, 3vw, 2.5rem)", { lineHeight: "1.25" }],
        hero:       ["clamp(2.6rem, 8vw, 7rem)",   { lineHeight: "1.0" }],
        body:       ["clamp(1rem, 1.5vw, 1.2rem)",  { lineHeight: "1.6" }],
      },
    },
  },
  plugins: [],
};

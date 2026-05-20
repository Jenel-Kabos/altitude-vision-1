/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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
        section: ["clamp(1.5rem, 4vw, 2.5rem)", { lineHeight: "1.2" }],
      },
    },
  },
  plugins: [],
};

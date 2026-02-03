/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        secondary: "#f59e0b", // couleur utilisée dans focus:ring-secondary
      },
    },
  },
  plugins: [],
};

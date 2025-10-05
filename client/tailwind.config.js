/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'primary': '#1E3A8A', // Bleu foncé
        'secondary': '#F59E0B', // Orange/Ambre
        'light': '#F3F4F6', // Gris clair
      }
    },
  },
  plugins: [],
}
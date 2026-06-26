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
        '4xl': '2560px',
      },
      colors: {
        gold: {
          DEFAULT: '#C8960C',
          light:   '#DCA815',
          dark:    '#9A710A',
          subtle:  'rgba(200,150,12,0.10)',
        },
        dark: {
          DEFAULT: '#090B0E',
          2:       '#111318',
          3:       '#181C24',
        },
        cream: '#F0EDE8',
        brand: {
          blue:  '#2E7BB5',
          red:   '#DC2626',
          green: '#16A34A',
        },
        secondary: '#C8960C',
      },
      fontFamily: {
        display:       ["'Cinzel'", "'Cormorant Garamond'", "Georgia", "serif"],
        'display-alt': ["'Cormorant Garamond'", "Georgia", "serif"],
        body:          ["'DM Sans'", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        sharp:   '0px',
        sm:      '4px',
        DEFAULT: '4px',
        md:      '8px',
        lg:      '12px',
        pill:    '40px',
      },
      fontSize: {
        hero:         ["clamp(2.6rem,8vw,7rem)",   { lineHeight: "1.0"  }],
        section:      ["clamp(1.5rem,4vw,4.5rem)", { lineHeight: "1.15" }],
        'section-h3': ["clamp(1.4rem,3vw,2.5rem)", { lineHeight: "1.25" }],
        body:         ["clamp(1rem,1.5vw,1.2rem)",  { lineHeight: "1.65" }],
      },
      boxShadow: {
        card:  '0 4px 24px rgba(0,0,0,0.4)',
        hover: '0 16px 48px rgba(0,0,0,0.6)',
        gold:  '0 0 24px rgba(200,150,12,0.15)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [],
};
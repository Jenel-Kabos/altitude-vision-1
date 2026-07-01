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
        // ── Brand Gold (couleur principale) ──────────────────────
        gold: {
          DEFAULT: '#C8960C',
          light:   '#DCA815',
          dark:    '#9A710A',
          subtle:  'rgba(200,150,12,0.10)',
          border:  'rgba(200,150,12,0.18)',
        },
        // ── Fonds dark ───────────────────────────────────────────
        dark: {
          DEFAULT: '#090B0E',
          2:       '#111318',
          3:       '#181C24',
        },
        // ── Fond clair (sections light) ──────────────────────────
        surface: {
          DEFAULT: '#F8F8F8',
          card:    '#FFFFFF',
          soft:    '#F3F4F6',
        },
        cream: '#F0EDE8',
        // ── Palette texte clair ──────────────────────────────────
        ink: {
          DEFAULT: '#111827',   // texte principal sur fond clair
          mid:     '#374151',   // texte secondaire
          soft:    '#6B7280',   // texte tertiaire/muted
          faint:   '#9CA3AF',   // placeholder, métadonnées
        },
        // ── Accent de marque ─────────────────────────────────────
        brand: {
          blue:    '#2E7BB5',
          'blue-dark': '#1A5A8A',
          red:     '#DC2626',
          'red-dark': '#A01E1E',
          green:   '#16A34A',
        },
        // ── Rouge Mila Events (intentionnellement distinct de brand.red) ──
        mila: {
          red:  '#D42B2B',
        },
      },
      fontFamily: {
        display:       ["'Cinzel'",           "'Cormorant Garamond'", "Georgia", "serif"],
        'display-alt': ["'Cormorant Garamond'","Georgia",              "serif"],
        body:          ["'DM Sans'",           "-apple-system",        "sans-serif"],
      },
      borderRadius: {
        sharp: '0px',
        sm:    '4px',
        DEFAULT:'4px',
        md:    '8px',
        lg:    '12px',
        xl:    '16px',
        '2xl': '20px',
        '3xl': '24px',
        pill:  '40px',
      },
      fontSize: {
        hero:         ["clamp(2.6rem,8vw,7rem)",   { lineHeight: "1.0"  }],
        section:      ["clamp(1.5rem,4vw,4.5rem)", { lineHeight: "1.15" }],
        'section-h3': ["clamp(1.4rem,3vw,2.5rem)", { lineHeight: "1.25" }],
        body:         ["clamp(1rem,1.5vw,1.2rem)",  { lineHeight: "1.65" }],
      },
      boxShadow: {
        // Contexte dark
        card:  '0 4px 24px rgba(0,0,0,0.4)',
        hover: '0 16px 48px rgba(0,0,0,0.6)',
        gold:  '0 0 24px rgba(200,150,12,0.15)',
        // Contexte light
        'card-light':  '0 2px 12px rgba(0,0,0,0.06)',
        'hover-light': '0 8px 32px rgba(0,0,0,0.12)',
        'gold-light':  '0 4px 20px rgba(200,150,12,0.22)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [],
};

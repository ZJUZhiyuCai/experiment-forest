/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */

/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        forest: {
          primary: 'var(--forest-primary)',
          secondary: 'var(--forest-secondary)',
          accent: 'var(--forest-accent)',
          light: 'var(--forest-light)',
        },
        earth: {
          brown: 'var(--earth-brown)',
          beige: 'var(--earth-beige)',
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          error: 'var(--status-error)',
          info: 'var(--status-info)',
        },
        text: {
          main: 'var(--text-main)',
          soft: 'var(--text-soft)',
          muted: 'var(--text-muted)',
        }
      },
      fontFamily: {
        header: ['var(--font-header)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      borderRadius: {
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'nature': 'var(--shadow-nature)',
        'nature-lg': 'var(--shadow-nature-lg)',
      }
    },
  },
  plugins: [],
};

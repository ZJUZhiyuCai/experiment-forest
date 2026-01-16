/** 
 * 🌿 实验小森林 Tailwind 配置 v2.0.0
 * Organic/Natural Design System - 有机自然设计体系
 */

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
        // 有机自然调色板
        organic: {
          'rice-paper': 'var(--bg-rice-paper)',
          'card': 'var(--bg-card)',
          'stone': 'var(--bg-stone)',
          'sand': 'var(--bg-sand)',
        },
        moss: {
          DEFAULT: 'var(--moss-green)',
          light: 'var(--moss-light)',
          soft: 'var(--moss-soft)',
        },
        terracotta: {
          DEFAULT: 'var(--terracotta)',
          light: 'var(--terracotta-light)',
        },
        timber: {
          DEFAULT: 'var(--timber)',
          soft: 'var(--timber-soft)',
        },
        loam: 'var(--text-loam)',
        bark: 'var(--text-bark)',
        grass: 'var(--text-grass)',
        // 兼容旧系统
        forest: {
          primary: 'var(--forest-primary)',
          secondary: 'var(--forest-secondary)',
          accent: 'var(--forest-accent)',
          light: 'var(--forest-light)',
          ink: 'var(--forest-ink)',
          soft: 'var(--forest-soft)',
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
        },
        bg: {
          organic: 'var(--bg-organic)',
          pure: 'var(--bg-pure)',
        },
        border: {
          ink: 'var(--border-ink)',
          timber: 'var(--border-timber)',
        }
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        // 兼容旧系统
        header: ['var(--font-heading)', 'sans-serif'],
        display: ['var(--font-heading)', 'sans-serif'],
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': '1.5rem',
        '3xl': '2rem',
        'pill': 'var(--radius-pill)',
        // Organic blob shapes
        'blob-1': 'var(--radius-blob-1)',
        'blob-2': 'var(--radius-blob-2)',
        'blob-3': 'var(--radius-blob-3)',
      },
      boxShadow: {
        'moss': 'var(--shadow-moss)',
        'moss-lg': 'var(--shadow-moss-lg)',
        'clay': 'var(--shadow-clay)',
        'clay-lg': 'var(--shadow-clay-lg)',
        'float': 'var(--shadow-float)',
        // 兼容旧系统
        'nature': 'var(--shadow-nature)',
        'nature-lg': 'var(--shadow-nature-lg)',
        'minimal': 'var(--shadow-minimal)',
      },
      transitionTimingFunction: {
        'natural': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        'natural': '300ms',
        'gentle': '500ms',
      },
      animation: {
        'growth': 'growth-up 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'float': 'gentle-float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'slide-in': {
          '0%':   { opacity: '0', transform: 'translateY(-10px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
      },
      colors: {
        brand: {
          50:  '#fdf8ed',
          100: '#faedc9',
          300: '#f0c060',
          400: '#e8a020',
          500: '#d4891a',
          600: '#b87213',
          700: '#8f540d',
        },
      },
    },
  },
  plugins: [],
} satisfies Config

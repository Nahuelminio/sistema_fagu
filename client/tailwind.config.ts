import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
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

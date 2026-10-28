/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        studio: {
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          accent: '#38bdf8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        bangla: ['Noto Sans Bengali', 'SolaimanLipi', 'Kalpurush', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'karaoke-glow': 'karaoke 0.6s ease-in-out',
      },
      keyframes: {
        karaoke: {
          '0%': { transform: 'scale(1)', textShadow: '0 0 0 rgba(99, 102, 241, 0)' },
          '50%': { transform: 'scale(1.08)', textShadow: '0 0 12px rgba(99, 102, 241, 0.6)' },
          '100%': { transform: 'scale(1)', textShadow: '0 0 4px rgba(99, 102, 241, 0.3)' },
        }
      }
    },
  },
  plugins: [],
}

import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Geist Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
        display: [
          '"Geist Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: [
          '"Geist Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      colors: {
        // PIRANUSA Indigo Banking palette
        navy: {
          DEFAULT: '#1E1B4B',
          soft: '#312E81',
          deep: '#0E0C2E',
        },
        brand: {
          DEFAULT: '#6366F1',
          bright: '#818CF8',
          deep: '#4F46E5',
          soft: '#EEF2FF',
        },
        paper: '#F8FAFC',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#0F172A',
          muted: '#475569',
        },
      },
      letterSpacing: {
        tighter: '-0.022em',
        tightest: '-0.04em',
      },
      boxShadow: {
        dock: '0 8px 32px -8px rgba(30, 27, 75, 0.32), 0 2px 8px -2px rgba(30, 27, 75, 0.16)',
        card: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.03)',
        'card-hover': '0 8px 24px -6px rgba(30, 27, 75, 0.12), 0 2px 6px -2px rgba(30, 27, 75, 0.08)',
        focus: '0 0 0 4px rgba(99, 102, 241, 0.18)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%, 100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' },
        },
        'float-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'draw-stroke': {
          '0%': { strokeDashoffset: 'var(--draw-len, 1000)' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 500ms cubic-bezier(.16,1,.3,1) both',
        'fade-in': 'fade-in 400ms cubic-bezier(.16,1,.3,1) both',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s ease-in-out infinite',
        'float-soft': 'float-soft 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config

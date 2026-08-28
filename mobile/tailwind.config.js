/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#F8FAFC',
        ink: {
          DEFAULT: '#0F172A',
          soft: '#475569',
          faint: '#94A3B8',
        },
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.65)',
          strong: 'rgba(255, 255, 255, 0.85)',
          border: 'rgba(148, 163, 184, 0.25)',
        },
        accent: {
          DEFAULT: '#6366F1',
          soft: '#E0E7FF',
          mint: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
        },
      },
      borderRadius: {
        card: '20px',
        sheet: '28px',
      },
    },
  },
  plugins: [],
};

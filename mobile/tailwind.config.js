/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#F8F9FF',
          soft: '#EFF1FF',
        },
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#0F172A',
          soft: '#475569',
          muted: '#64748B',
          faint: '#94A3B8',
          ghost: '#CBD5E1',
        },
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.72)',
          strong: 'rgba(255, 255, 255, 0.92)',
          border: 'rgba(148, 163, 184, 0.18)',
          borderStrong: 'rgba(148, 163, 184, 0.28)',
        },
        accent: {
          DEFAULT: '#6366F1',
          soft: '#EEF2FF',
          softStrong: '#E0E7FF',
          mint: '#10B981',
          mintSoft: '#ECFDF5',
          amber: '#F59E0B',
          amberSoft: '#FFFBEB',
          rose: '#F43F5E',
          roseSoft: '#FFF1F2',
        },
        line: 'rgba(148,163,184,0.16)',
      },
      borderRadius: {
        card: '20px',
        cardLg: '24px',
        pill: '9999px',
        sheet: '28px',
      },
      boxShadow: {
        card: '0 8px 32px rgba(15,23,42,0.06)',
        cardHover: '0 12px 40px rgba(15,23,42,0.09)',
        fab: '0 10px 24px rgba(99,102,241,0.35)',
      },
      fontSize: {
        hero: ['28px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '800' }],
        title: ['20px', { lineHeight: '26px', letterSpacing: '-0.01em', fontWeight: '700' }],
        body: ['15px', { lineHeight: '22px' }],
      },
    },
  },
  plugins: [],
};

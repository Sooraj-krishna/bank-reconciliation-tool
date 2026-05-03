/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: '#FDFBF7',
        sage: '#F0F4F1',
        charcoal: '#1A1A1A',
        slate: '#64748B',
        emerald: '#059669',
        'deep-emerald': '#059669',
        'pale-sage': '#F0F4F1',
        'warm-ivory': '#FDFBF7',
        'muted-slate': '#64748B',
        'deep-charcoal': '#1A1A1A',
        'light-gray': '#F8FAFC',
        'near-black': '#0F172A',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      borderRadius: {
        'card': '12px',
        'full': '9999px',
      },
      boxShadow: {
        'custom': '0 4px 24px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'draw': {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'draw': 'draw 2s ease-out forwards',
      },
    },
  },
  plugins: [],
};

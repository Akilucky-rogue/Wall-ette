module.exports = {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './context/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Theme-driven palette: every color reads a CSS variable set by
      // utils/theme.ts, so switching themes recolors the whole app live.
      // `white` is remapped to the card surface on purpose — dark themes turn
      // cards dark and text-white flips to dark ink automatically.
      colors: {
        'zen-bg': 'rgb(var(--c-bg) / <alpha-value>)',
        'zen-cream': 'rgb(var(--c-card-alt) / <alpha-value>)',
        'white': 'rgb(var(--c-card) / <alpha-value>)',
        'premium-charcoal': 'rgb(var(--c-ink) / <alpha-value>)',
        'zen-charcoal': 'rgb(var(--c-ink-2) / <alpha-value>)',
        'muted-taupe': 'rgb(var(--c-mut) / <alpha-value>)',
        'zen-taupe': 'rgb(var(--c-mut) / <alpha-value>)',
        'sage': 'rgb(var(--c-sage) / <alpha-value>)',
        'sage-light': 'rgb(var(--c-sage-soft) / <alpha-value>)',
        'sage-border': 'rgb(var(--c-sage-line) / <alpha-value>)',
        'rose': 'rgb(var(--c-rose) / <alpha-value>)',
        'rose-light': 'rgb(var(--c-rose-soft) / <alpha-value>)',
        'lavender': 'rgb(var(--c-lavender) / <alpha-value>)',
        'lavender-light': 'rgb(var(--c-lavender-soft) / <alpha-value>)',
        'sand': 'rgb(var(--c-sand) / <alpha-value>)',
        'sand-light': 'rgb(var(--c-sand-soft) / <alpha-value>)',
        'ocean': 'rgb(var(--c-ocean) / <alpha-value>)',
        'ocean-light': 'rgb(var(--c-ocean-soft) / <alpha-value>)',
        'blue-zen': 'rgb(var(--c-bluez) / <alpha-value>)',
        'blue-zen-light': 'rgb(var(--c-bluez-soft) / <alpha-value>)',
        'sage-translucent': 'rgb(var(--c-sage) / 0.15)',
        'blue-translucent': 'rgb(var(--c-bluez) / 0.15)',
        // Tailwind's gray scale, remapped so gray surfaces/borders follow the
        // theme instead of glaring light-gray on dark palettes.
        'gray': {
          50: 'rgb(var(--c-card-alt) / <alpha-value>)',
          100: 'rgb(var(--c-line) / <alpha-value>)',
          200: 'rgb(var(--c-line) / <alpha-value>)',
          300: 'rgb(var(--c-line-2) / <alpha-value>)',
          400: 'rgb(var(--c-mut) / <alpha-value>)',
          500: 'rgb(var(--c-mut) / <alpha-value>)',
          600: 'rgb(var(--c-ink-2) / <alpha-value>)',
          700: 'rgb(var(--c-ink-2) / <alpha-value>)',
          800: 'rgb(var(--c-ink) / <alpha-value>)',
          900: 'rgb(var(--c-ink) / <alpha-value>)',
        },
      },
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'serif': ['Crimson Pro', 'serif'],
      },
      borderRadius: {
        '2xl': '1.25rem', // 20px
        '3xl': '1.75rem', // 28px
        '4xl': '2.25rem', // 36px
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.03)',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

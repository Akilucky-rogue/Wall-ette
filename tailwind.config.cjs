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
      // Surfaces lit from above (styles.css, utils/theme.ts): a hairline
      // edge, a contact shadow and a soft drop in the page's own warm tone,
      // with a highlight on the top edge. `raised` for the wallet and primary
      // buttons, `float` for panels and sheets, `pressed` for a pushed-in well.
      boxShadow: {
        'soft': '0 0 0 1px rgb(var(--shadow-rgb) / 0.035), 0 1px 2px rgb(var(--shadow-rgb) / 0.06), 0 10px 24px -12px rgb(var(--shadow-rgb) / 0.22), inset 0 1px 0 var(--edge-hi)',
        'raised': '0 1px 2px rgb(var(--shadow-rgb) / 0.10), 0 6px 12px -4px rgb(var(--shadow-rgb) / 0.14), 0 22px 40px -16px rgb(var(--shadow-rgb) / 0.40)',
        'float': '0 0 0 1px rgb(var(--shadow-rgb) / 0.05), 0 4px 10px rgb(var(--shadow-rgb) / 0.08), 0 30px 60px -20px rgb(var(--shadow-rgb) / 0.42)',
        'pressed': 'inset 0 1px 3px rgb(var(--shadow-rgb) / 0.14), inset 0 0 0 1px rgb(var(--shadow-rgb) / 0.04)',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // Screen changes (App.tsx): a page slides in over the one it opens
        // from; going back slides the other way; tabs shift a little.
        pageIn: {
          '0%': { transform: 'translateX(28px)', opacity: '0' },
          '100%': { transform: 'none', opacity: '1' },
        },
        pageBack: {
          '0%': { transform: 'translateX(-28px)', opacity: '0' },
          '100%': { transform: 'none', opacity: '1' },
        },
        tabIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'page-in': 'pageIn 0.26s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'page-back': 'pageBack 0.26s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'tab-in': 'tabIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

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
      colors: {
        'zen-bg': '#FAF9F6',
        'zen-cream': '#FDFBF7',
        'premium-charcoal': '#333333',
        'zen-charcoal': '#4A4947',
        'muted-taupe': '#8E8D8A',
        'zen-taupe': '#8E8D8A',
        'sage': '#9BAE93',
        'sage-light': '#E3EAE0',
        'sage-border': '#D1DDCB',
        'rose': '#D4A5A5',
        'rose-light': '#F5E6E6',
        'lavender': '#B8B5D0',
        'lavender-light': '#EBEAF2',
        'sand': '#D6C6B2',
        'sand-light': '#F4EFE9',
        'ocean': '#9CB5C1',
        'ocean-light': '#E6EEF2',
        'blue-zen': '#A7BBC7',
        'blue-zen-light': '#E6EEF2',
        'sage-translucent': 'rgba(155, 174, 147, 0.15)',
        'blue-translucent': 'rgba(167, 187, 199, 0.15)',
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

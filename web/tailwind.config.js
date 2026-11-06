export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        divider: 'var(--divider)',
        accent: 'var(--accent)',
        'accent-pressed': 'var(--accent-pressed)',
        highlight: 'var(--highlight)',
        'highlight-pressed': 'var(--highlight-pressed)',
        zone: {
          R: '#E8EFE5',
          'R/E': '#DCEBD3',
          E: '#CFE6C4',
          'E/D': '#AED2A4',
          D: '#8DBE84',
          'D/C': '#C4CF8A',
          C: '#FBE08F',
          'C/B': '#F6C976',
          B: '#EBA960',
          A: '#DD855A',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

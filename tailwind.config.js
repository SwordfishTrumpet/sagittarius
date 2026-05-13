/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        icloud: {
          // CSS variable based colors — light/dark swap automatically
          'bg-primary': 'var(--icloud-bg-primary)',
          'bg-sidebar': 'var(--icloud-bg-sidebar)',
          'bg-layer1': 'var(--icloud-bg-layer1)',
          'bg-layer2': 'var(--icloud-bg-layer2)',
          'text-primary': 'var(--icloud-text-primary)',
          'text-secondary': 'var(--icloud-text-secondary)',
          'text-tertiary': 'var(--icloud-text-tertiary)',
          'accent': 'var(--icloud-accent)',
          'accent-hover': 'var(--icloud-accent-hover)',
          'border': 'var(--icloud-border)',
          'divider': 'var(--icloud-divider)',
          'red': 'var(--icloud-red)',
          'orange': 'var(--icloud-orange)',
          'yellow': 'var(--icloud-yellow)',
          'green': 'var(--icloud-green)',
          'gray1': 'var(--icloud-gray1)',
          'gray2': 'var(--icloud-gray2)',
          'gray3': 'var(--icloud-gray3)',
          'gray4': 'var(--icloud-gray4)',
          'gray5': 'var(--icloud-gray5)',
          'gray6': 'var(--icloud-gray6)',
          'card': 'var(--icloud-card)',
          'shadow': 'var(--icloud-shadow)',
          'scrollbar-thumb': 'var(--icloud-scrollbar-thumb)',
          'scrollbar-thumb-hover': 'var(--icloud-scrollbar-thumb-hover)',
        },
      },
      boxShadow: {
        'icloud': 'var(--icloud-shadow-standard)',
      },
      borderRadius: {
        'icloud': '12px',
      },
    },
  },
  plugins: [],
}

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
        apple: {
          blue: '#007AFF',
          blueDark: '#0A84FF',
          gray: '#8E8E93',
          grayDark: '#8E8E93',
          background: '#F2F2F7',
          backgroundDark: '#000000',
        }
      }
    },
  },
  plugins: [],
}

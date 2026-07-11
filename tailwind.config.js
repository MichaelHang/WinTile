/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: '#1a6b3c',
        'felt-dark': '#145530',
        ivory: '#f5f0e8',
        'ivory-dark': '#e8e0d0',
        gold: '#c9a94e',
        'gold-light': '#e8d48b',
        'red-china': '#c41e3a',
        wood: '#8b6914',
        'wood-dark': '#5c4510',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
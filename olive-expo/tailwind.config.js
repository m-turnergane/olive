/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'olive-deep': '#1B3A2F',
        'olive-accent': '#0C221B',
        'olive-sage': '#5E8C61',
        'olive-mint': '#97C09E',
        'olive-light': '#F0F4F1',
        'olive-pale-sage': '#BAC7B2',
        'calm-blue': '#A7CAE3',
      },
    },
  },
  plugins: [],
};


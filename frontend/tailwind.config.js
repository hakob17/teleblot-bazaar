/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-bg': '#0f172a',    // slate-900
        'game-card': '#1e293b',  // slate-800
        'game-accent': '#38bdf8',// sky-400
        'game-danger': '#ef4444',// red-500
        'game-success': '#22c55e',// green-500
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

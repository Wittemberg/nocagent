/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        noc: {
          bg: '#090d16',
          card: '#0f172a',
          cardHover: '#1e293b',
          border: '#334155',
          accent: '#0284c7',
          online: '#10b981',
          offline: '#ef4444',
          warning: '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}

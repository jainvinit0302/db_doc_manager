/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coralLight: "#FEE2E2",
        coral: "#F87171",
        coralDark: "#EF4444",
        cream: "#FFF7ED",
      },
    },
  },
  plugins: [],
};

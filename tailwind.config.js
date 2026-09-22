/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        cream: "#f8f6f1",
        coral: "#ff725e",
        mint: "#d9f5e9"
      },
      boxShadow: { soft: "0 20px 70px rgba(23,23,23,.10)" }
    }
  },
  plugins: []
};

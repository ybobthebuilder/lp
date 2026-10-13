/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Design system A — swatches from the Virunga reference.
        canopy: "#264A31",
        lava: "#F27D16",
        fur: "#333333",
        moss: "#6B854A",
        night: "#07110c",
        mist: "#e4eed6"
      },
      boxShadow: { soft: "0 24px 80px rgba(7,17,12,.45)" }
    }
  },
  plugins: []
};

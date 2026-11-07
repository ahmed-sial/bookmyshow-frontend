/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      //cinema-indexed color tokens (auditorium / seat / screen / marquee...)
      colors: {
        auditorium: "#191243",
        seat: "#241A59",
        screen: "#F3F0EA",
        reel: "#A9A0D6",
        marquee: {
          DEFAULT: "#FFB454",
          press: "#F0A63C",
        },
        ember: "#FF8A80",
      },
      fontFamily: {
        display: [
          "Anton",
          "Archivo",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        body: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

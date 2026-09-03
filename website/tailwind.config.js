/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Pulled directly from crypto-wallet/constants/Theme.js's darkTheme —
        // the website mirrors the app's real palette, not an invented one.
        ink: "#0a0a0a", // background
        surface: "#131313",
        card: "#161616",
        card2: "#1c1c1c",
        border: "#232323",
        hair: "#2a2a2a",
        text: "#ffffff",
        muted: "#b3b3b3",
        dim: "#808080",
        lime: "#d6ff00", // primary
        limeDark: "#8ba600", // primaryDark (pressed/depth)
        limeTint: "#1d2400", // primaryLight (tinted bg)
      },
      fontFamily: {
        display: ["'Unbounded'", "sans-serif"],
        body: ["'Manrope'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      maxWidth: {
        wrap: "1200px",
      },
      keyframes: {
        "ping-slow": {
          "0%": { transform: "scale(0.85)", opacity: "0.6" },
          "80%, 100%": { transform: "scale(1.25)", opacity: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "ping-slow": "ping-slow 2.6s cubic-bezier(0,0,0.2,1) infinite",
        marquee: "marquee 28s linear infinite",
      },
    },
  },
  plugins: [],
};

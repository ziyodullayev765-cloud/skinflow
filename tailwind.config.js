/** @type {import('tailwindcss').Config} */
export default {
  content: ["./web/index.html", "./web/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface-2) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        accent2: "rgb(var(--accent-2) / <alpha-value>)",
        coin: "rgb(var(--coin) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        r: {
          common: "#9aa4b2",
          uncommon: "#5fb3ff",
          rare: "#8b7dff",
          epic: "#e05cff",
          legendary: "#ffb547",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["'Space Grotesk'", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { xl2: "1.125rem" },
      screens: { xs: "375px" },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        shine: { "0%": { transform: "translateX(-120%) skewX(-18deg)" }, "60%,100%": { transform: "translateX(220%) skewX(-18deg)" } },
        spinSlow: { to: { transform: "rotate(360deg)" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        shine: "shine 3.2s ease-in-out infinite",
        spinSlow: "spinSlow 6s linear infinite",
        floaty: "floaty 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

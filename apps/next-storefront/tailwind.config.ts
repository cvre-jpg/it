import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f6f1",
        ink: "#101314",
        accent: "#cb2f2f",
        pine: "#1f4d3a",
        sand: "#ece7dd",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(16, 19, 20, 0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;

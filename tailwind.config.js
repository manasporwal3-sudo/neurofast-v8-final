/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // NeuroFast cyber palette
        cyan: { neon: "#00f0ff", dark: "#00a8b5", glow: "#00f0ff33" },
        magenta: { neon: "#ff00aa", dark: "#b5007a", glow: "#ff00aa33" },
        matrix: { green: "#00ff41", dim: "#003b00" },
        void: {
          black: "#0a0a0a",   // v8 fix: add void-black for admin layout bg
          100: "#1a1a2e",
          200: "#13131f",
          300: "#0d0d1a",
          400: "#0a0a12",
          500: "#070710",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
        display: ["'Orbitron'", "sans-serif"],
        body: ["'Rajdhani'", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 5px #00f0ff, 0 0 20px #00f0ff33" },
          "50%": { boxShadow: "0 0 20px #00f0ff, 0 0 60px #00f0ff55" },
        },
        "glow-magenta": {
          "0%, 100%": { boxShadow: "0 0 5px #ff00aa, 0 0 20px #ff00aa33" },
          "50%": { boxShadow: "0 0 20px #ff00aa, 0 0 60px #ff00aa55" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        flicker: {
          "0%, 95%, 100%": { opacity: "1" },
          "96%": { opacity: "0.8" },
          "97%": { opacity: "1" },
          "98%": { opacity: "0.6" },
          "99%": { opacity: "1" },
        },
        matrix: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 100%" },
        },
        "pulse-cyan": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "fade-up": {
          from: { transform: "translateY(20px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        glow: "glow 2s ease-in-out infinite",
        "glow-magenta": "glow-magenta 2s ease-in-out infinite",
        scan: "scan 8s linear infinite",
        flicker: "flicker 4s infinite",
        "pulse-cyan": "pulse-cyan 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "fade-up": "fade-up 0.5s ease-out",
      },
      backgroundImage: {
        "grid-cyber":
          "linear-gradient(rgba(0,240,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.03) 1px, transparent 1px)",
        "grid-magenta":
          "linear-gradient(rgba(255,0,170,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,170,0.03) 1px, transparent 1px)",
        "neon-gradient": "linear-gradient(135deg, #00f0ff, #ff00aa)",
        "dark-gradient": "linear-gradient(180deg, #0a0a12 0%, #070710 100%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(0,240,255,0.05), rgba(255,0,170,0.05))",
      },
      backgroundSize: {
        "grid-30": "30px 30px",
        "grid-60": "60px 60px",
      },
      boxShadow: {
        "neon-cyan": "0 0 10px #00f0ff, 0 0 40px #00f0ff33, inset 0 0 10px #00f0ff11",
        "neon-magenta": "0 0 10px #ff00aa, 0 0 40px #ff00aa33, inset 0 0 10px #ff00aa11",
        "neon-sm": "0 0 5px #00f0ff, 0 0 15px #00f0ff33",
        cyber: "0 4px 30px rgba(0,240,255,0.1), 0 0 0 1px rgba(0,240,255,0.1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

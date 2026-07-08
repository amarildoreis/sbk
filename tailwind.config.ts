import type { Config } from "tailwindcss";

// Paleta oficial SBK Capital — paleta_sbk_v2 (ver CLAUDE.md seção 5.1)
// Fonte única da verdade para cor no produto. Não aproximar valores.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "azul-marca": "#12183F", // exclusivo da logomarca — não usar como cor de UI geral
        "azul-escuro": "#1A2347", // primária institucional de UI
        "azul-medio": "#2E3F7F", // estados ativos, hover, links
        "cinza-prata": "#C8CDD6", // bordas, divisores, texto secundário sobre fundo escuro
        "verde-escuro": "#2D5C3A", // positivo/aprovado forte
        "verde-claro": "#4A8C5C", // positivo secundário
        "vermelho-risco": "#B3495A", // semântica de risco
        "ambar-alerta": "#C99A3E", // semântica de atenção
        surface: "#FFFFFF",
        "surface-alt": "#F7F8FA",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        premium:
          "0 1px 2px rgba(18,24,63,0.04), 0 8px 24px -8px rgba(18,24,63,0.12), 0 24px 48px -24px rgba(18,24,63,0.18)",
        "premium-sm": "0 1px 2px rgba(18,24,63,0.06), 0 4px 12px -4px rgba(18,24,63,0.10)",
      },
      backgroundImage: {
        "brand-panel":
          "radial-gradient(120% 120% at 15% 0%, #1B2452 0%, #12183F 55%, #0D1230 100%)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.8s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;

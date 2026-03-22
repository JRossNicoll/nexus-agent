/**
 * MEDO Design System — shared tokens extracted from the v0 landing page.
 * Both the landing page and the app import from here.
 */

export const ds = {
  /* ── Background colours ── */
  bg: {
    base:    "#0a0a0a",
    surface: "#111111",
    raised:  "#1a1a1a",
    hover:   "#222222",
    input:   "#1a1a1a",
    card:    "#0d0d0d",
    cardHover: "#141414",
  },

  /* ── Accent (red) + opacity variants ── */
  accent: {
    DEFAULT: "#ff3333",
    hover:   "#e62e2e",
    soft:    "#ff5555",
    "5":   "rgba(255,51,51,0.05)",
    "8":   "rgba(255,51,51,0.08)",
    "10":  "rgba(255,51,51,0.10)",
    "12":  "rgba(255,51,51,0.12)",
    "15":  "rgba(255,51,51,0.15)",
    "20":  "rgba(255,51,51,0.20)",
    "25":  "rgba(255,51,51,0.25)",
    "30":  "rgba(255,51,51,0.30)",
    "40":  "rgba(255,51,51,0.40)",
  },

  /* ── Text colours ── */
  text: {
    primary:   "#f5f5f5",
    secondary: "#999999",
    muted:     "#888888",
    dim:       "#777777",
    faint:     "#666666",
    ghost:     "#555555",
    darkest:   "#444444",
  },

  /* ── Border colours ── */
  border: {
    DEFAULT:  "#2a2a2a",
    subtle:   "#1a1a1a",
    mid:      "#333333",
    bright:   "#444444",
    accent10: "rgba(255,51,51,0.10)",
    accent20: "rgba(255,51,51,0.20)",
    accent25: "rgba(255,51,51,0.25)",
    accent30: "rgba(255,51,51,0.30)",
    accent40: "rgba(255,51,51,0.40)",
  },

  /* ── Typography ── */
  font: {
    sans:  "'Inter', 'Geist', sans-serif",
    mono:  "'JetBrains Mono', 'Geist Mono', monospace",
  },
  fontSize: {
    xs:   "11px",
    sm:   "13px",
    base: "14px",
    md:   "15px",
    lg:   "18px",
    xl:   "24px",
    "2xl":"32px",
    "3xl":"40px",
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold:   700,
  },

  /* ── Border radius ── */
  radius: {
    sm:  "6px",
    md:  "10px",
    lg:  "14px",
    xl:  "18px",
    full: "9999px",
  },

  /* ── Shadows ── */
  shadow: {
    card:      "0 4px 16px rgba(0,0,0,0.3)",
    glow:      "0 0 30px rgba(255,51,51,0.4)",
    glowSoft:  "0 0 20px rgba(255,51,51,0.3)",
    glowFaint: "0 0 15px rgba(255,51,51,0.1)",
    modal:     "0 16px 64px rgba(0,0,0,0.5)",
  },

  /* ── Button styles ── */
  button: {
    primary: {
      bg: "#ff3333",
      hoverBg: "#e62e2e",
      color: "#ffffff",
      shadow: "0 0 30px rgba(255,51,51,0.4)",
    },
    ghost: {
      bg: "transparent",
      hoverBg: "rgba(255,51,51,0.05)",
      color: "#ffffff",
      border: "#333333",
      hoverBorder: "rgba(255,51,51,0.30)",
    },
    outline: {
      bg: "transparent",
      hoverBg: "rgba(255,51,51,0.05)",
      color: "#ff3333",
      border: "rgba(255,51,51,0.25)",
      hoverBorder: "rgba(255,51,51,0.40)",
    },
  },

  /* ── Status colours ── */
  status: {
    green:  "#5ec26a",
    amber:  "#ebb95a",
    red:    "#eb645a",
  },

  /* ── Card styles ── */
  card: {
    bg:       "#0d0d0d",
    border:   "#1a1a1a",
    hoverBorder: "rgba(255,51,51,0.25)",
    hoverShadow: "0 0 30px rgba(255,51,51,0.06)",
  },
} as const;

/* CSS custom property map for easy use in inline styles */
export const cssVars = {
  "--bg-base":     ds.bg.base,
  "--bg-surface":  ds.bg.surface,
  "--bg-raised":   ds.bg.raised,
  "--bg-hover":    ds.bg.hover,
  "--bg-input":    ds.bg.input,
  "--border":      ds.border.DEFAULT,
  "--border-mid":  ds.border.mid,
  "--border-bright": ds.border.bright,
  "--text-1":      ds.text.primary,
  "--text-2":      ds.text.secondary,
  "--text-3":      ds.text.muted,
  "--text-4":      ds.text.dim,
  "--accent":      ds.accent.DEFAULT,
  "--accent-mid":  ds.accent["10"],
  "--accent-low":  ds.accent["5"],
  "--accent-glow": ds.accent["20"],
  "--green":       ds.status.green,
  "--amber":       ds.status.amber,
  "--red":         ds.status.red,
  "--font-ui":     ds.font.sans,
  "--font-mono":   ds.font.mono,
  "--r-sm":        ds.radius.sm,
  "--r-md":        ds.radius.md,
  "--r-lg":        ds.radius.lg,
  "--r-xl":        ds.radius.xl,
} as const;

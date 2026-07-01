import type { Config } from "tailwindcss";

/**
 * BETK Tailwind configuration — UI Spec §1
 *
 * All color tokens are mapped from CSS custom properties (globals.css)
 * so that shadcn/ui components and BETK components share the same
 * single source of truth. Never hardcode hex/rgb values in components.
 *
 * RTL: Tailwind 3.3+ has built-in logical-property utilities
 * (ps-*, pe-*, ms-*, me-*, start-*, end-*, rounded-s-*, rounded-e-*).
 * No tailwindcss-rtl plugin is required.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* ── Color tokens (all via CSS vars, HSL) ── */
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        /* ── Catalog (Phase 03 design-catalog kit) ── */
        // Contrast-corrected status text (used on /15 tints)
        "warning-text": "hsl(var(--warning-text))",
        "accent-text": "hsl(var(--accent-text))",

        // Rating star gold
        star: "hsl(var(--star))",

        // Seller-level metallics (bg / fg / ring)
        "level-bronze-bg": "hsl(var(--level-bronze-bg))",
        "level-bronze-fg": "hsl(var(--level-bronze-fg))",
        "level-bronze-ring": "hsl(var(--level-bronze-ring))",
        "level-silver-bg": "hsl(var(--level-silver-bg))",
        "level-silver-fg": "hsl(var(--level-silver-fg))",
        "level-silver-ring": "hsl(var(--level-silver-ring))",
        "level-gold-bg": "hsl(var(--level-gold-bg))",
        "level-gold-fg": "hsl(var(--level-gold-fg))",
        "level-gold-ring": "hsl(var(--level-gold-ring))",
      },

      /* ── Border radius — 0.625 rem base (UI Spec §1) ── */
      borderRadius: {
        // --radius = 0.625rem (10 px)
        lg: "var(--radius)",            // cards, sheets
        md: "calc(var(--radius) - 2px)", // buttons, inputs
        sm: "calc(var(--radius) - 4px)", // small elements
        full: "9999px",                  // pills, badges
      },

      /* ── Type scale (UI Spec §1, rem) ── */
      fontSize: {
        // Custom BETK names that extend Tailwind defaults
        display: ["2.25rem", { lineHeight: "3rem", fontWeight: "700" }],
        h1:      ["1.875rem", { lineHeight: "2.25rem", fontWeight: "700" }],
        h2:      ["1.5rem",   { lineHeight: "2rem",    fontWeight: "600" }],
        h3:      ["1.25rem",  { lineHeight: "1.75rem", fontWeight: "600" }],
        // lg, base, sm, xs match Tailwind defaults — no override needed
      },

      /* ── Font families (CSS vars injected by next/font in layout.tsx) ── */
      fontFamily: {
        display: ["var(--font-display)", "IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        body:    ["var(--font-body)",    "Noto Sans Arabic",     "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)",    "ui-monospace",         "monospace"],
        sans:    ["var(--font-body)",    "Noto Sans Arabic",     "system-ui", "sans-serif"],
      },

      /* ── Shadows (UI Spec §1) ── */
      boxShadow: {
        // sm  → cards at rest
        // md  → hover/active listing cards
        // lg  → sheets, popovers, dialogs
        // Tailwind's built-in sm/md/lg shadows are used as-is;
        // add BETK-specific aliases for semantic clarity
        card:   "0 1px 3px 0 hsl(222 22% 14% / 0.08), 0 1px 2px -1px hsl(222 22% 14% / 0.06)",
        "card-hover": "0 4px 6px -1px hsl(222 22% 14% / 0.10), 0 2px 4px -2px hsl(222 22% 14% / 0.08)",
        dialog: "0 20px 25px -5px hsl(222 22% 14% / 0.12), 0 8px 10px -6px hsl(222 22% 14% / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

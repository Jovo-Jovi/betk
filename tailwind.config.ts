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
        /* ── DS-REGEN additive: informational status (brief §2.4b, FLAG-F) ── */
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
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

        /* ── DS-REGEN additive: theme-independent footer band (§2.3/§5.37) ── */
        "footer-bg": "hsl(var(--footer-bg))",
        "footer-fg": "hsl(var(--footer-fg))",
        "footer-logo": "hsl(var(--footer-logo))",
      },

      /* ── Border radius — 0.75rem/12px base (FLAG-G, brief §3.3) ── */
      borderRadius: {
        // --radius = 0.75rem (12px) — supersedes main's 0.625rem
        lg: "var(--radius)",             // 12px — cards, sheets, modals, galleries
        md: "calc(var(--radius) - 2px)", // 10px — buttons, inputs
        sm: "calc(var(--radius) - 4px)", // 8px — checkbox, focus insets
        full: "9999px",                  // pills, badges, avatars, search
      },

      /* ── Type scale (brief §3.1, rem) ── */
      fontSize: {
        display: ["2.25rem", { lineHeight: "1.3", fontWeight: "800" }],
        h1:      ["1.875rem", { lineHeight: "1.3", fontWeight: "700" }],
        h2:      ["1.5rem",   { lineHeight: "1.3", fontWeight: "700" }],
        h3:      ["1.25rem",  { lineHeight: "1.3", fontWeight: "600" }],
        // lg, base, sm, xs match Tailwind defaults — no override needed
        // (Arabic body copy uses leading-loose ≈ 1.8 per §3.1)
      },

      /* ── Font families (CSS vars injected by next/font in layout.tsx) ──
         Kept VERBATIM from repo main per sign-off 2026-07-17. A corrected
         fallback set (display→Cairo, body→IBM Plex Sans Arabic, mono→IBM Plex
         Mono) is PROPOSED in CHANGELOG.md — not applied here. */
      fontFamily: {
        display: ["var(--font-display)", "IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        body:    ["var(--font-body)",    "Noto Sans Arabic",     "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)",    "ui-monospace",         "monospace"],
        sans:    ["var(--font-body)",    "Noto Sans Arabic",     "system-ui", "sans-serif"],
      },

      /* ── Shadows — tokenized 4-step scale (brief §3.4) ──
         REPLACES the legacy card/card-hover/dialog aliases. Migration:
         shadow-card → shadow-sm · shadow-card-hover → shadow-md ·
         shadow-dialog → shadow-xl. ui/sonner.tsx (immutable) still names
         shadow-card, but it is superseded by shared/Toaster.tsx and no
         longer mounted — do not re-add the alias. */
      boxShadow: {
        sm: "var(--shadow-sm)",   // cards at rest
        md: "var(--shadow-md)",   // hover/active lift
        lg: "var(--shadow-lg)",   // sheets, popovers, toasts
        xl: "var(--shadow-xl)",   // dialogs
      },

      /* ── Layout + effect tokens (brief §2.4/§3.2) ── */
      spacing: {
        sidebar: "var(--sidebar-width)",       // 260px
        topbar: "var(--topbar-height)",        // 64px
        bottomnav: "var(--bottom-nav-height)", // 60px
      },
      maxWidth: {
        container: "var(--container-max)",     // 1280px
      },
      backdropBlur: {
        card: "var(--card-blur)",              // 12px glass surfaces
      },
    },
  },
  plugins: [],
};

export default config;

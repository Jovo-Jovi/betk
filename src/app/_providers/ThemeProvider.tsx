"use client";

/**
 * ThemeProvider — light/dark theming via next-themes (OD-7).
 *
 * Class strategy on <html> (`attribute="class"`, toggling `.dark`), which is how
 * the BETK design tokens are defined (globals.css `:root` + `.dark`, shipped in
 * Phase 01 T03). `defaultTheme="system"` respects the OS preference until the
 * user picks a theme (the Account → Settings switcher lands in BL-03).
 *
 * `disableTransitionOnChange` avoids a color-transition flash when the class
 * flips. Persistence is next-themes' localStorage (no DB column — OD-7).
 *
 * Must be a client component. The <html suppressHydrationWarning> in the locale
 * layout absorbs the class next-themes injects before hydration.
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

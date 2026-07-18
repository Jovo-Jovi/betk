"use client";

/**
 * HeroSection — homepage hero, per BETK_DESIGN_BRIEF.md §5.31. Phase 03 / T02.
 *
 * Page-level composition (no dedicated "Hero" component in the T00 catalog
 * kit — the brief describes it as page-level markup composing SearchBar).
 * The §5.31 gradient stops (`--hero-gradient-from`/`-to`, additive tokens in
 * globals.css) are the ONLY sanctioned hardcoded-color-derived literals for
 * this section; every other color is an existing token (accent/white on the
 * teal gradient, both already used elsewhere for foreground-on-brand text).
 *
 * SearchBar itself is composed unmodified; its default popover/foreground
 * styling is kept (via the exposed `className` extension point, not a
 * component edit) rather than forcing a literal "translucent white on teal"
 * glass treatment that would require reaching into its internal <input>/
 * <svg> via child-selector hacks — a deliberate, flagged simplification of
 * the brief's ".hero-search" glass-input description.
 */

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { SearchBar } from "@/components/shared";

export interface HeroSectionProps {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  searchClearLabel: string;
}

export function HeroSection({ title, subtitle, searchPlaceholder, searchClearLabel }: HeroSectionProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(value: string) {
    const q = value.trim();
    router.push(q ? `${routes.search}?q=${encodeURIComponent(q)}` : routes.search);
  }

  return (
    <section className="relative overflow-hidden rounded-b-[2rem] px-4 py-16 text-center text-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(160deg,hsl(var(--hero-gradient-from)),hsl(var(--hero-gradient-to)))]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle,white_1px,transparent_1px)] [background-size:18px_18px]"
      />
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 size-64 rounded-full bg-accent/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -start-20 bottom-0 size-72 rounded-full bg-white/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-4">
        <h1 className="font-display text-display font-extrabold drop-shadow-sm">{title}</h1>
        <p className="text-lg text-white/90">{subtitle}</p>
        <div className="mt-2 w-full max-w-[540px]">
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={handleSubmit}
            placeholder={searchPlaceholder}
            clearLabel={searchClearLabel}
            size="lg"
            className="border-white/40 bg-white/90 shadow-lg backdrop-blur-lg"
          />
        </div>
      </div>
    </section>
  );
}

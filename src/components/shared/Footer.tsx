"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Footer — fixed dark band, theme-independent (brief §5.37). Net-new (CD-DELTA-1,
 * signed off 2026-07-18: authored in the brief but omitted from the §7 inventory).
 * Colors via the sanctioned --footer-bg/-fg/-logo tokens — never theme tokens for
 * the band itself. ب mark + plain-text "BETK" wordmark (LOGO-SYNC parked — no
 * lockup, no derivations). Link columns are string-prop arrays; Cursor owns the
 * ar/en catalog entries. Wire hrefs with next/link via onLinkClick or href.
 * Link hover uses --footer-logo (signed off 2026-07-18). ZERO raw color values
 * (CD-DELTA-1-FIX): headings --footer-fg (bright), links/body --footer-fg-muted,
 * divider composed as hsl(var(--footer-fg)/0.1) — StoreCard precedent, no token.
 */
export interface FooterLink {
  label: string;
  href?: string;
}
export interface FooterColumn {
  title: string;
  links: FooterLink[];
}
export interface FooterProps {
  /** Path to the ب mark asset. Default "/logo/beh.png". */
  logoSrc?: string;
  /** Tagline under the wordmark. Default "سوق بيتك — منصة الاقتصاد الإبداعي المصري.". */
  tagline?: string;
  /** Link columns (string-prop arrays). */
  columns?: FooterColumn[];
  onLinkClick?: (link: FooterLink) => void;
  /** Bottom-bar copy. Default "© 2026 بيتك". */
  copyright?: string;
  className?: string;
}

const DEFAULT_COLUMNS: FooterColumn[] = [
  { title: "السوق", links: [{ label: "التصنيفات" }, { label: "المتاجر" }, { label: "العروض المميزة" }] },
  { title: "للبائعين", links: [{ label: "افتح متجرك" }, { label: "لوحة البائع" }] },
  { title: "المساعدة", links: [{ label: "مركز المساعدة" }, { label: "تواصل معنا" }] },
];

export function Footer({
  logoSrc = "/logo/beh.png", tagline = "سوق بيتك — منصة الاقتصاد الإبداعي المصري.",
  columns = DEFAULT_COLUMNS, onLinkClick, copyright = "© 2026 بيتك", className,
}: FooterProps) {
  return (
    <footer className={cn("bg-footer-bg px-4 py-12 text-footer-fg-muted", className)}>
      <div className="mx-auto grid max-w-[var(--container-max)] grid-cols-[2fr_1fr_1fr_1fr] gap-8 max-md:grid-cols-2 max-[480px]:grid-cols-1">
        <div>
          <span className="inline-flex items-center gap-2">
            <img src={logoSrc} alt="" className="size-[34px] rounded-full object-cover" />
            <span className="font-display text-h2 font-extrabold text-footer-logo">BETK</span>
          </span>
          <p className="mt-2 max-w-[320px] text-sm leading-[1.8]">{tagline}</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-bold text-footer-fg">{col.title}</h4>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {col.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href ?? "#"}
                    onClick={(e) => { if (!link.href) e.preventDefault(); onLinkClick?.(link); }}
                    className="text-footer-fg-muted transition-colors hover:text-footer-logo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-8 border-t border-[hsl(var(--footer-fg)/0.1)] pt-4 text-center text-xs opacity-60">{copyright}</div>
    </footer>
  );
}

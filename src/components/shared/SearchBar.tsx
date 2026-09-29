import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

/**
 * SearchBar — pill search input. RTL: magnifier on the start side, clear on
 * the end. i18n: placeholder (already a prop) + the clear-button aria-label
 * come in as props with Arabic defaults. Controlled.
 * CD-DELTA-6 (REG-58): dark theme sits the pill on --background (a recessed
 * well, distinct from the --card/--popover topbar surface) with a
 * --muted-foreground-composed boundary, so the field edge, text and
 * placeholder stay legible in dark without hover; native search-cancel glyph
 * suppressed (it rendered off-token in dark and duplicated the clear button);
 * keyboard focus ring added. Light theme unchanged.
 */
export interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  /** Input placeholder. Default "ابحث في بيتك…". */
  placeholder?: string;
  /** Clear-button aria-label. Default "مسح". */
  clearLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const H = { sm: "h-10", md: "h-[46px]", lg: "h-[52px]" } as const;

export function SearchBar({ value = "", onChange, onSubmit, placeholder = "ابحث في بيتك…", clearLabel = "مسح", size = "md", className }: SearchBarProps) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit?.(value); }}
      className={cn("flex items-center gap-2 rounded-full border border-input bg-popover px-3.5 shadow-sm focus-within:ring-2 focus-within:ring-ring dark:border-muted-foreground/60 dark:bg-background", H[size], className)}
    >
      <Search className="size-[19px] shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button type="button" onClick={() => onChange?.("")} aria-label={clearLabel} className="rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-[17px]" />
        </button>
      )}
    </form>
  );
}

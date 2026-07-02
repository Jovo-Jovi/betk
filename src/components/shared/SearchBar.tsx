import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

/**
 * SearchBar — pill search input. RTL: magnifier on the start side, clear on
 * the end. i18n: placeholder (already a prop) + the clear-button aria-label
 * come in as props with Arabic defaults. Controlled.
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
      className={cn("flex items-center gap-2 rounded-full border border-input bg-popover px-3.5 shadow-card", H[size], className)}
    >
      <Search className="size-[19px] shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button type="button" onClick={() => onChange?.("")} aria-label={clearLabel} className="text-muted-foreground">
          <X className="size-[17px]" />
        </button>
      )}
    </form>
  );
}

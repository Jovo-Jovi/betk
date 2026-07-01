import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

/**
 * SearchBar — pill search input. RTL: magnifier on the start side, clear on
 * the end. Arabic placeholder. Controlled.
 */
export interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const H = { sm: "h-10", md: "h-[46px]", lg: "h-[52px]" } as const;

export function SearchBar({ value = "", onChange, onSubmit, placeholder = "ابحث في بيتك…", size = "md", className }: SearchBarProps) {
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
        <button type="button" onClick={() => onChange?.("")} aria-label="مسح" className="text-muted-foreground">
          <X className="size-[17px]" />
        </button>
      )}
    </form>
  );
}

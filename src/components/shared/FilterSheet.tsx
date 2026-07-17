import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/**
 * FilterSheet — search/category filter panel. i18n: ALL chrome strings come
 * in via a single `labels` object (Arabic default) — section titles, type &
 * sort option labels, placeholders, and the apply/result-count text.
 * Controlled. Composes ui/button, ui/input, ui/select. Price inputs are LTR.
 */
export interface FilterValue {
  category?: string | null;
  type?: "all" | "product" | "service";
  governorate?: string | null;
  priceMin?: number | string;
  priceMax?: number | string;
  sort?: "relevance" | "newest" | "price_asc" | "popular";
}

export interface FilterSheetLabels {
  title: string;
  clear: string;
  category: string;
  type: string;
  governorate: string;
  priceRange: string;
  sort: string;
  allGovernorates: string;
  /** Apply button when no resultCount is given. */
  apply: string;
  /** Apply button with count; "{count}" is interpolated. */
  resultCount: string;
  types: Record<"all" | "product" | "service", string>;
  sorts: Record<"relevance" | "newest" | "price_asc" | "popular", string>;
}

const DEFAULT_LABELS: FilterSheetLabels = {
  title: "تصفية",
  clear: "مسح",
  category: "الفئة",
  type: "النوع",
  governorate: "المحافظة",
  priceRange: "نطاق السعر (ج.م)",
  sort: "الترتيب",
  allGovernorates: "كل المحافظات",
  apply: "تطبيق",
  resultCount: "عرض {count} نتيجة",
  types: { all: "الكل", product: "منتجات", service: "خدمات" },
  sorts: { relevance: "الأكثر صلة", newest: "الأحدث", price_asc: "السعر: من الأقل", popular: "الأكثر رواجًا" },
};

export interface FilterSheetProps {
  value?: FilterValue;
  onChange?: (next: FilterValue) => void;
  onApply?: () => void;
  onClear?: () => void;
  categories?: { id: string; nameAr: string }[];
  governorates?: { value: string; labelAr: string }[];
  resultCount?: number;
  asSheet?: boolean;
  /** Chrome-string overrides; merged over the Arabic defaults. */
  labels?: Partial<FilterSheetLabels>;
  className?: string;
}

function Pill({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold",
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-border py-4">
      <h3 className="font-display text-[0.9375rem] font-bold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function FilterSheet({ value = {}, onChange, onApply, onClear, categories = [], governorates = [], resultCount, asSheet, labels, className }: FilterSheetProps) {
  const t: FilterSheetLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    types: { ...DEFAULT_LABELS.types, ...labels?.types },
    sorts: { ...DEFAULT_LABELS.sorts, ...labels?.sorts },
  };
  const set = (patch: Partial<FilterValue>) => onChange?.({ ...value, ...patch });
  const TYPES = ["all", "product", "service"] as const;
  const SORTS = ["relevance", "newest", "price_asc", "popular"] as const;
  return (
    <aside className={cn("flex w-72 flex-col overflow-hidden border border-border bg-card shadow-sm", asSheet ? "w-full rounded-t-lg" : "rounded-lg", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <span className="font-display text-base font-bold">{t.title}</span>
        <button type="button" onClick={onClear} className="text-[0.8125rem] font-semibold text-muted-foreground">{t.clear}</button>
      </div>
      <div className="overflow-y-auto px-4">
        {categories.length > 0 && (
          <Section title={t.category}>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Pill key={c.id} active={value.category === c.id} onClick={() => set({ category: value.category === c.id ? null : c.id })}>{c.nameAr}</Pill>
              ))}
            </div>
          </Section>
        )}
        <Section title={t.type}>
          <div className="flex gap-2">
            {TYPES.map((v) => <Pill key={v} active={(value.type ?? "all") === v} onClick={() => set({ type: v })}>{t.types[v]}</Pill>)}
          </div>
        </Section>
        {governorates.length > 0 && (
          <Section title={t.governorate}>
            <Select value={value.governorate ?? ""} onValueChange={(v) => set({ governorate: v || null })}>
              <SelectTrigger><SelectValue placeholder={t.allGovernorates} /></SelectTrigger>
              <SelectContent>
                {governorates.map((g) => <SelectItem key={g.value} value={g.value}>{g.labelAr}</SelectItem>)}
              </SelectContent>
            </Select>
          </Section>
        )}
        <Section title={t.priceRange}>
          <div className="flex items-center gap-2" dir="ltr">
            <Input type="number" inputMode="numeric" placeholder="0" value={value.priceMin ?? ""} onChange={(e) => set({ priceMin: e.target.value })} className="w-1/2 font-mono" />
            <span className="text-muted-foreground">—</span>
            <Input type="number" inputMode="numeric" placeholder="∞" value={value.priceMax ?? ""} onChange={(e) => set({ priceMax: e.target.value })} className="w-1/2 font-mono" />
          </div>
        </Section>
        <Section title={t.sort}>
          <div className="flex flex-wrap gap-2">
            {SORTS.map((v) => <Pill key={v} active={(value.sort ?? "relevance") === v} onClick={() => set({ sort: v })}>{t.sorts[v]}</Pill>)}
          </div>
        </Section>
      </div>
      <div className="border-t border-border p-3.5">
        <Button className="w-full" onClick={onApply}>
          {typeof resultCount === "number" ? t.resultCount.replace("{count}", String(resultCount)) : t.apply}
        </Button>
      </div>
    </aside>
  );
}

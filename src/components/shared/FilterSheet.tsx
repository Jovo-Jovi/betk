import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/**
 * FilterSheet — search/category filter panel (side panel on desktop; mount
 * inside ui/sheet on mobile via `asSheet`). Controlled. Composes ui/button,
 * ui/input, ui/select. RTL-safe; price inputs are LTR islands.
 */
export interface FilterValue {
  category?: string | null;
  type?: "all" | "product" | "service";
  governorate?: string | null;
  priceMin?: number | string;
  priceMax?: number | string;
  sort?: "relevance" | "newest" | "price_asc" | "popular";
}

export interface FilterSheetProps {
  value?: FilterValue;
  onChange?: (next: FilterValue) => void;
  onApply?: () => void;
  onClear?: () => void;
  categories?: { id: string; nameAr: string }[];
  governorates?: { value: string; labelAr: string }[];
  resultCount?: number;
  asSheet?: boolean;
  className?: string;
}

const TYPES = [["all", "الكل"], ["product", "منتجات"], ["service", "خدمات"]] as const;
const SORTS = [["relevance", "الأكثر صلة"], ["newest", "الأحدث"], ["price_asc", "السعر: من الأقل"], ["popular", "الأكثر رواجًا"]] as const;

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

export function FilterSheet({ value = {}, onChange, onApply, onClear, categories = [], governorates = [], resultCount, asSheet, className }: FilterSheetProps) {
  const set = (patch: Partial<FilterValue>) => onChange?.({ ...value, ...patch });
  return (
    <aside className={cn("flex w-72 flex-col overflow-hidden border border-border bg-card shadow-card", asSheet ? "w-full rounded-t-lg" : "rounded-lg", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <span className="font-display text-base font-bold">تصفية</span>
        <button type="button" onClick={onClear} className="text-[0.8125rem] font-semibold text-muted-foreground">مسح</button>
      </div>
      <div className="overflow-y-auto px-4">
        {categories.length > 0 && (
          <Section title="الفئة">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Pill key={c.id} active={value.category === c.id} onClick={() => set({ category: value.category === c.id ? null : c.id })}>{c.nameAr}</Pill>
              ))}
            </div>
          </Section>
        )}
        <Section title="النوع">
          <div className="flex gap-2">
            {TYPES.map(([v, ar]) => <Pill key={v} active={(value.type ?? "all") === v} onClick={() => set({ type: v })}>{ar}</Pill>)}
          </div>
        </Section>
        {governorates.length > 0 && (
          <Section title="المحافظة">
            <Select value={value.governorate ?? ""} onValueChange={(v) => set({ governorate: v || null })}>
              <SelectTrigger><SelectValue placeholder="كل المحافظات" /></SelectTrigger>
              <SelectContent>
                {governorates.map((g) => <SelectItem key={g.value} value={g.value}>{g.labelAr}</SelectItem>)}
              </SelectContent>
            </Select>
          </Section>
        )}
        <Section title="نطاق السعر (ج.م)">
          <div className="flex items-center gap-2" dir="ltr">
            <Input type="number" inputMode="numeric" placeholder="0" value={value.priceMin ?? ""} onChange={(e) => set({ priceMin: e.target.value })} className="w-1/2 font-mono" />
            <span className="text-muted-foreground">—</span>
            <Input type="number" inputMode="numeric" placeholder="∞" value={value.priceMax ?? ""} onChange={(e) => set({ priceMax: e.target.value })} className="w-1/2 font-mono" />
          </div>
        </Section>
        <Section title="الترتيب">
          <div className="flex flex-wrap gap-2">
            {SORTS.map(([v, ar]) => <Pill key={v} active={(value.sort ?? "relevance") === v} onClick={() => set({ sort: v })}>{ar}</Pill>)}
          </div>
        </Section>
      </div>
      <div className="border-t border-border p-3.5">
        <Button className="w-full" onClick={onApply}>
          {typeof resultCount === "number" ? `عرض ${resultCount} نتيجة` : "تطبيق"}
        </Button>
      </div>
    </aside>
  );
}

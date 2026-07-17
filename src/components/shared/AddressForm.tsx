"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/**
 * AddressForm / AddressSelect — delivery-address entry + saved-address picker
 * (brief §5.8 form anatomy). Net-new (DS-REGEN). Composes ui/input, ui/select,
 * ui/button. Phone is an LTR mono island. Controlled; per-field errors.
 */
export interface AddressValue {
  fullName?: string;
  phone?: string;
  governorate?: string;
  city?: string;
  addressLine?: string;
  notes?: string;
}

export interface AddressFormLabels {
  fullName: string; phone: string; governorate: string; city: string;
  addressLine: string; notes: string; save: string;
}

const DEFAULT_LABELS: AddressFormLabels = {
  fullName: "الاسم الكامل", phone: "رقم الهاتف", governorate: "المحافظة", city: "المدينة",
  addressLine: "العنوان بالتفصيل", notes: "ملاحظات للتوصيل (اختياري)", save: "حفظ العنوان",
};

export interface AddressFormProps {
  value?: AddressValue;
  onChange?: (next: AddressValue) => void;
  onSubmit?: (value: AddressValue) => void;
  governorates?: { value: string; labelAr: string }[];
  /** Field-label overrides; merged over the Arabic defaults. */
  labels?: Partial<AddressFormLabels>;
  /** Per-field error messages. */
  errors?: Partial<Record<keyof AddressValue, string>>;
  submitting?: boolean;
  className?: string;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-2 block text-sm font-semibold text-foreground">{label}</label>
      {children}
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
    </div>
  );
}

export function AddressForm({ value = {}, onChange, onSubmit, governorates = [], labels, errors = {}, submitting = false, className }: AddressFormProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const set = (patch: Partial<AddressValue>) => onChange?.({ ...value, ...patch });
  const err = (k: keyof AddressValue) => (errors[k] ? "border-destructive" : undefined);
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); onSubmit?.(value); }}>
      <Field label={t.fullName} error={errors.fullName}>
        <Input value={value.fullName ?? ""} onChange={(e) => set({ fullName: e.target.value })} className={err("fullName")} />
      </Field>
      <Field label={t.phone} error={errors.phone}>
        <Input dir="ltr" inputMode="tel" value={value.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} className={cn("font-mono", err("phone"))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.governorate} error={errors.governorate}>
          <Select value={value.governorate ?? ""} onValueChange={(v) => set({ governorate: v })}>
            <SelectTrigger className={err("governorate")}><SelectValue /></SelectTrigger>
            <SelectContent>
              {governorates.map((g) => <SelectItem key={g.value} value={g.value}>{g.labelAr}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.city} error={errors.city}>
          <Input value={value.city ?? ""} onChange={(e) => set({ city: e.target.value })} className={err("city")} />
        </Field>
      </div>
      <Field label={t.addressLine} error={errors.addressLine}>
        <textarea
          value={value.addressLine ?? ""} onChange={(e) => set({ addressLine: e.target.value })}
          className={cn("flex min-h-[100px] w-full resize-y rounded-md border border-input bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring", err("addressLine"))}
        />
      </Field>
      <Field label={t.notes}>
        <Input value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      <Button type="submit" className="w-full" disabled={submitting}>{t.save}</Button>
    </form>
  );
}

export interface AddressOption {
  id: string;
  label: string;
  detail?: string;
}
export interface AddressSelectProps {
  addresses?: AddressOption[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

export function AddressSelect({ addresses = [], selectedId, onSelect, className }: AddressSelectProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {addresses.map((a) => {
        const active = a.id === selectedId;
        return (
          <button
            key={a.id} type="button" onClick={() => onSelect?.(a.id)} aria-pressed={active}
            className={cn(
              "flex flex-col gap-1 rounded-md p-3 px-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-2 border-primary bg-primary/[0.04]" : "border border-border bg-card",
            )}
          >
            <span className="text-sm font-bold text-foreground">{a.label}</span>
            {a.detail && <span className="text-xs leading-relaxed text-muted-foreground">{a.detail}</span>}
          </button>
        );
      })}
    </div>
  );
}

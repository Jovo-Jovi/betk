import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * Stepper — horizontal numbered progress for multi-step flows (brief §5.22).
 * Net-new (CD-DELTA-3, Phase-04 kit gate). No shadcn registry primitive exists,
 * so this is a pure shared component per the brief's authored anatomy.
 * State is derived from `current`: index < current = completed (success + check),
 * index === current = active (primary + glow + scale), index > current = pending.
 * Step labels are bilingual string props (DS-I18N). RTL: source order + the
 * connector gradient follow page direction (logical flow + rtl gradient variant).
 */
export interface StepperStep {
  label: string;
}
export interface StepperProps {
  /** Ordered steps — plain label strings or `{ label }` objects. */
  steps: Array<string | StepperStep>;
  /** Active step index (0-based). Earlier steps render completed. Default 0. */
  current?: number;
  className?: string;
}

export function Stepper({ steps, current = 0, className }: StepperProps) {
  return (
    <ol className={cn("flex items-start", className)}>
      {steps.map((s, i) => {
        const label = typeof s === "string" ? s : s.label;
        const state = i < current ? "completed" : i === current ? "active" : "pending";
        return (
          <React.Fragment key={i}>
            <li className="flex flex-col items-center gap-2">
              <span
                aria-current={state === "active" ? "step" : undefined}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold shadow-sm transition-transform",
                  state === "completed" && "border-success bg-success text-primary-foreground",
                  state === "active" && "scale-110 border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                  state === "pending" && "border-border bg-card text-muted-foreground",
                )}
              >
                {state === "completed" ? <Check size={18} /> : i + 1}
              </span>
              <span className={cn("text-xs font-bold", state === "active" ? "text-primary" : "text-muted-foreground")}>{label}</span>
            </li>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-2 mt-[16px] h-[3px] flex-1 rounded-full",
                  i < current ? "bg-gradient-to-r from-success to-primary rtl:bg-gradient-to-l" : "bg-border",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

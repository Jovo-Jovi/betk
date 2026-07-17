import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * OrderTimeline — vertical order-progress rail (brief §5.21). Net-new
 * (DS-REGEN). Rail + dots sit on the inline-start edge (mirrors
 * automatically). completed = success, active = primary + glow,
 * pending = border grey. Times are LTR mono islands.
 */
export interface TimelineStep {
  id?: string | number;
  title: string;
  time?: string;
  state?: "pending" | "active" | "completed";
}
export interface OrderTimelineProps {
  steps?: TimelineStep[];
  className?: string;
}

const DOT: Record<string, string> = {
  completed: "bg-success",
  active: "bg-primary ring-[3px] ring-primary/20",
  pending: "bg-border",
};

export function OrderTimeline({ steps = [], className }: OrderTimelineProps) {
  return (
    <div className={cn("border-s-2 border-border ps-4", className)}>
      {steps.map((s, i) => {
        const state = s.state ?? "pending";
        return (
          <div key={s.id ?? i} className={cn("relative ps-6", i < steps.length - 1 && "pb-5")}>
            <span className={cn("absolute -start-[23px] top-1 size-3 rounded-full border-2 border-card", DOT[state])} />
            <div className={cn("text-sm font-semibold", state === "pending" ? "text-muted-foreground" : "text-foreground")}>{s.title}</div>
            {s.time && <div dir="ltr" className="text-end font-mono text-xs text-muted-foreground">{s.time}</div>}
          </div>
        );
      })}
    </div>
  );
}

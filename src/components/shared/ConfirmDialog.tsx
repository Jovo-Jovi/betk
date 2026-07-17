"use client";

import * as React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * ConfirmDialog — blocking confirm before every irreversible/destructive
 * action (brief §5.25). Net-new (DS-REGEN). Composes ui/dialog + ui/button.
 * Toasts announce outcomes; dialogs make decisions — never mix the two.
 */
export interface ConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  /** Body content (or use `message`). */
  children?: React.ReactNode;
  message?: string;
  /** Confirm label. Default "تأكيد". */
  confirmLabel?: string;
  /** Cancel label. Default "إلغاء". */
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  /** Red confirm button for destructive actions. */
  destructive?: boolean;
  /** Disables the confirm button while the mutation runs. */
  loading?: boolean;
}

export function ConfirmDialog({
  open = false, onOpenChange, title, children, message,
  confirmLabel = "تأكيد", cancelLabel = "إلغاء", onConfirm, onCancel, destructive = false, loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange?.(o); if (!o) onCancel?.(); }}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          {(children ?? message) && <DialogDescription className="leading-loose text-foreground/80">{children ?? message}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { onCancel?.(); onOpenChange?.(false); }}>{cancelLabel}</Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} disabled={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

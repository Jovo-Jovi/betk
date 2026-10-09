import type { CartBlock } from "./cartRules";

export interface CartPageLine {
  lineId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  isCustom: boolean;
  stockQty: number | null;
  quoteExpiresAt: string | null;
  inquiryId: string | null;
  storeName: string;
  blockedReason: CartBlock["blockedReason"];
  stockLabel: CartBlock["stockLabel"];
}

/** A read-time prompt. Not a cart_items row. */
export interface DroppedQuotePrompt {
  inquiryId: string;
  title: string;
  storeName: string;
  unitPrice: number;
  quantity: number;
}

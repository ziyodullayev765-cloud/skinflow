import { create } from "zustand";
import type { Rarity, WeaponType } from "../lib/types";

export type SortKey = "newest" | "rarity" | "value";

interface InventoryFilters {
  search: string;
  rarity: Rarity | "all";
  weapon: WeaponType | "all";
  collection: string | "all";
  sort: SortKey;
  set: (p: Partial<Omit<InventoryFilters, "set" | "reset">>) => void;
  reset: () => void;
}

/** Filters live outside the page component so they survive tab switches. */
export const useInventoryFilters = create<InventoryFilters>((set) => ({
  search: "",
  rarity: "all",
  weapon: "all",
  collection: "all",
  sort: "newest",
  set: (p) => set(p),
  reset: () => set({ search: "", rarity: "all", weapon: "all", collection: "all" }),
}));

interface Toast {
  id: number;
  text: string;
  tone: "success" | "error" | "info";
}

interface ToastState {
  toasts: Toast[];
  push: (text: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (text, tone = "info") => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

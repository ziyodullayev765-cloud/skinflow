import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Lang } from "../lib/i18n";

/** localStorage can throw (private mode, blocked storage) — fall back to memory. */
const memory = new Map<string, string>();
const safeStorage = {
  getItem: (k: string): string | null => {
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem: (k: string, v: string): void => {
    try {
      localStorage.setItem(k, v);
    } catch {
      memory.set(k, v);
    }
  },
  removeItem: (k: string): void => {
    try {
      localStorage.removeItem(k);
    } catch {
      memory.delete(k);
    }
  },
} satisfies StateStorage;

export interface SettingsState {
  language: Lang;
  sound: boolean;
  animations: boolean;
  haptics: boolean;
  darkTheme: boolean;
  reducedMotion: boolean;
  languageChosen: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

function detectLang(): Lang {
  const code = (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 2);
  return code === "ru" ? "ru" : code === "uz" ? "uz" : "en";
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: detectLang(),
      sound: true,
      animations: true,
      haptics: true,
      darkTheme: true,
      reducedMotion: typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
      languageChosen: false,
      set: (patch) => set(patch),
    }),
    { name: "skinflow:settings", storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
);

/** Motion is reduced when the user asks for it OR turns animations off. */
export const useReducedMotion = () => useSettings((s) => s.reducedMotion || !s.animations);

export { safeStorage };

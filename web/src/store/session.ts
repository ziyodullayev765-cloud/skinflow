import { create } from "zustand";
import { ApiError, api, setAuthToken, setUnauthorizedHandler } from "../lib/api";
import { initData, isTelegram } from "../lib/telegram";
import { reloadIfOutdated } from "../lib/version";
import type { AppConfig, Me } from "../lib/types";
import { safeStorage } from "./settings";

const TOKEN_KEY = "skinflow:token";

type Status = "idle" | "loading" | "ready" | "needs-telegram" | "error";

interface SessionState {
  status: Status;
  error: ApiError | null;
  config: AppConfig | null;
  bootstrap: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => void;
}

async function fetchConfig(): Promise<AppConfig | null> {
  try {
    return await api.get<AppConfig>("/api/config");
  } catch {
    return null;
  }
}

export const useSession = create<SessionState>((set, get) => ({
  status: "idle",
  error: null,
  config: null,

  bootstrap: async () => {
    set({ status: "loading", error: null });
    setUnauthorizedHandler(() => {
      safeStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
      if (get().status === "ready") set({ status: "error", error: new ApiError("INVALID_SESSION", "Session expired", 401) });
    });
    const config = await fetchConfig();
    if (reloadIfOutdated(config?.build)) return;
    set({ config });
    try {
      // 1) Inside Telegram: always exchange fresh signed initData for a server token.
      if (isTelegram()) {
        const r = await api.post<{ token: string; user: Me }>("/api/auth/telegram", { initData: initData() });
        setAuthToken(r.token);
        set({ status: "ready" });
        return;
      }
      // 2) Browser: reuse a previous server-issued token if still valid.
      const saved = safeStorage.getItem(TOKEN_KEY);
      if (saved) {
        setAuthToken(saved);
        try {
          await api.get("/api/me");
          set({ status: "ready" });
          return;
        } catch (e) {
          if (e instanceof ApiError && (e.code === "NETWORK" || e.code === "SERVER" || e.code === "MAINTENANCE")) throw e;
          safeStorage.removeItem(TOKEN_KEY);
          setAuthToken(null);
        }
      }
      set({ status: "needs-telegram" });
    } catch (e) {
      set({ status: "error", error: e instanceof ApiError ? e : new ApiError("SERVER", String(e)) });
    }
  },

  loginAsGuest: async () => {
    set({ status: "loading", error: null });
    try {
      const r = await api.post<{ token: string; user: Me }>("/api/auth/guest", {});
      safeStorage.setItem(TOKEN_KEY, r.token);
      setAuthToken(r.token);
      set({ status: "ready" });
    } catch (e) {
      set({ status: "error", error: e instanceof ApiError ? e : new ApiError("SERVER", String(e)) });
    }
  },

  logout: () => {
    safeStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    set({ status: "needs-telegram" });
  },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ApiError } from "./lib/api";
import { initTelegram } from "./lib/telegram";
import { checkForUpdate } from "./lib/version";
import "./styles.css";

initTelegram();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      gcTime: 10 * 60_000,
      // Admin changes (prices, images, cases) should show up as soon as players return.
      refetchOnWindowFocus: true,
      retry: (count, err) => {
        if (err instanceof ApiError && !["NETWORK", "SERVER"].includes(err.code)) return false;
        return count < 2;
      },
    },
    mutations: { retry: false },
  },
});

// Telegram keeps Mini Apps alive in the background: refresh data when the user comes back.
try {
  window.Telegram?.WebApp?.onEvent?.("activated", () => {
    void checkForUpdate();
    void queryClient.invalidateQueries();
  });
} catch {
  /* not in Telegram */
}

// Browsers: check for a new deploy whenever the tab becomes visible again.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void checkForUpdate();
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

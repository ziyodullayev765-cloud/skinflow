/* Thin, defensive wrapper around the Telegram WebApp SDK. Every call is a no-op outside Telegram. */

type HapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";
type HapticNotify = "error" | "success" | "warning";

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string; photo_url?: string } };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  setBottomBarColor?(c: string): void;
  disableVerticalSwipes?(): void;
  onEvent(e: string, cb: (...a: unknown[]) => void): void;
  offEvent(e: string, cb: (...a: unknown[]) => void): void;
  HapticFeedback?: {
    impactOccurred(s: HapticImpact): void;
    notificationOccurred(t: HapticNotify): void;
    selectionChanged(): void;
  };
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void; isVisible: boolean };
  MainButton?: {
    text: string;
    isVisible: boolean;
    setText(t: string): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
    setParams(p: Record<string, unknown>): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export function tg(): TgWebApp | null {
  const w = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  return w && typeof w.ready === "function" ? w : null;
}

/** True only when launched from Telegram with signed initData. */
export function isTelegram(): boolean {
  return !!tg()?.initData;
}

export function initData(): string {
  return tg()?.initData ?? "";
}

let hapticsEnabled = true;
export function setHapticsEnabled(v: boolean) {
  hapticsEnabled = v;
}

export const haptic = {
  impact(style: HapticImpact = "light") {
    if (!hapticsEnabled) return;
    try {
      tg()?.HapticFeedback?.impactOccurred(style);
    } catch {
      /* unsupported */
    }
  },
  notify(type: HapticNotify) {
    if (!hapticsEnabled) return;
    try {
      tg()?.HapticFeedback?.notificationOccurred(type);
    } catch {
      /* unsupported */
    }
  },
  select() {
    if (!hapticsEnabled) return;
    try {
      tg()?.HapticFeedback?.selectionChanged();
    } catch {
      /* unsupported */
    }
  },
};

function applyViewport(app: TgWebApp) {
  const root = document.documentElement.style;
  root.setProperty("--tg-viewport-height", `${app.viewportHeight || window.innerHeight}px`);
  root.setProperty("--tg-viewport-stable-height", `${app.viewportStableHeight || window.innerHeight}px`);
  const sa = app.safeAreaInset;
  const csa = app.contentSafeAreaInset;
  if (sa) {
    root.setProperty("--tg-safe-area-inset-top", `${sa.top}px`);
    root.setProperty("--tg-safe-area-inset-bottom", `${sa.bottom}px`);
  }
  if (csa) root.setProperty("--tg-content-safe-area-inset-top", `${(sa?.top ?? 0) + csa.top}px`);
}

export function initTelegram(): void {
  const app = tg();
  if (!app) return;
  try {
    app.ready();
    app.expand();
    if (app.isVersionAtLeast?.("6.1")) {
      app.setHeaderColor?.("#0b0c0f");
      app.setBackgroundColor?.("#0b0c0f");
    }
    if (app.isVersionAtLeast?.("7.10")) app.setBottomBarColor?.("#0b0c0f");
    if (app.isVersionAtLeast?.("7.7")) app.disableVerticalSwipes?.();
    applyViewport(app);
    const update = () => applyViewport(app);
    app.onEvent("viewportChanged", update);
    app.onEvent("safeAreaChanged", update);
    app.onEvent("contentSafeAreaChanged", update);
  } catch {
    /* older clients */
  }
}

export function setTelegramColors(theme: "dark" | "light") {
  const app = tg();
  if (!app?.isVersionAtLeast?.("6.1")) return;
  const c = theme === "dark" ? "#0b0c0f" : "#f2f3f7";
  try {
    app.setHeaderColor?.(c);
    app.setBackgroundColor?.(c);
    if (app.isVersionAtLeast("7.10")) app.setBottomBarColor?.(c);
  } catch {
    /* ignore */
  }
}

export function supportsBackButton(): boolean {
  const app = tg();
  return !!app?.BackButton && !!app.initData && app.isVersionAtLeast("6.1");
}

export function supportsMainButton(): boolean {
  const app = tg();
  return !!app?.MainButton && !!app.initData;
}

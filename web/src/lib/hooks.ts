import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { haptic, supportsBackButton, supportsMainButton, tg } from "./telegram";

/* A stack of back handlers: only the top-most (most recently mounted) one runs. */
const backStack: { current: () => void }[] = [];
let backBound = false;
function dispatchBack() {
  haptic.impact("light");
  backStack[backStack.length - 1]?.current();
}

/** Shows Telegram's native BackButton while mounted. */
export function useTelegramBack(onBack?: () => void) {
  const navigate = useNavigate();
  const cb = useRef<() => void>(() => undefined);
  cb.current = onBack ?? (() => navigate(-1));
  useEffect(() => {
    if (!supportsBackButton()) return;
    const bb = tg()!.BackButton!;
    if (!backBound) {
      bb.onClick(dispatchBack);
      backBound = true;
    }
    backStack.push(cb);
    bb.show();
    return () => {
      const i = backStack.lastIndexOf(cb);
      if (i >= 0) backStack.splice(i, 1);
      if (backStack.length === 0) bb.hide();
    };
  }, []);
}

/** Shows Telegram's MainButton while `text` is set. Returns whether native MainButton is in use. */
export function useTelegramMainButton(text: string | null, onClick: () => void): boolean {
  const cb = useRef(onClick);
  cb.current = onClick;
  const native = supportsMainButton();
  useEffect(() => {
    if (!native || !text) return;
    const mb = tg()!.MainButton!;
    const handler = () => cb.current();
    mb.setParams({ text, color: "#8b9bff", text_color: "#0b0c0f", is_active: true, is_visible: true });
    mb.onClick(handler);
    return () => {
      mb.offClick(handler);
      mb.hide();
    };
  }, [text, native]);
  return native && !!text;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

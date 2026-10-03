import { useSettings } from "../store/settings";

export type SoundName = "tap" | "open" | "tick" | "reveal" | "achievement";

const cache = new Map<SoundName, HTMLAudioElement>();
const VOLUME: Record<SoundName, number> = { tap: 0.25, tick: 0.18, open: 0.4, reveal: 0.5, achievement: 0.45 };

/** Short, quiet effects. Never autoplays: only called from user-initiated flows. */
export function playSound(name: SoundName) {
  if (!useSettings.getState().sound) return;
  try {
    let a = cache.get(name);
    if (!a) {
      a = new Audio(`/assets/sounds/${name}.wav`);
      a.preload = "auto";
      cache.set(name, a);
    }
    a.volume = VOLUME[name];
    if (name === "tick") {
      const c = a.cloneNode() as HTMLAudioElement;
      c.volume = VOLUME.tick;
      void c.play().catch(() => undefined);
      return;
    }
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  } catch {
    /* audio unsupported */
  }
}

import { useEffect, useRef } from "react";
import { useReducedMotion } from "../store/settings";

/**
 * Very low-opacity drifting particles on a single canvas.
 * Pauses when the tab/Telegram app is hidden and when reduced motion is on.
 */
export function Particles({ count = 26, className }: { count?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ps = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.05 - Math.random() * 0.18,
      a: 0.08 + Math.random() * 0.22,
      hue: Math.random() > 0.5 ? "139,155,255" : "92,225,230",
    }));
    let raf = 0;
    let running = true;
    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -4) {
          p.y = h + 4;
          p.x = Math.random() * w;
        }
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.hue},${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const tgApp = window.Telegram?.WebApp;
    const onActive = () => onVis();
    document.addEventListener("visibilitychange", onVis);
    tgApp?.onEvent?.("activated", onActive);
    tgApp?.onEvent?.("deactivated", () => {
      running = false;
      cancelAnimationFrame(raf);
    });
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      tgApp?.offEvent?.("activated", onActive);
      window.removeEventListener("resize", resize);
    };
  }, [count, reduced]);

  if (reduced) return null;
  return <canvas ref={ref} className={className ?? "pointer-events-none absolute inset-0 h-full w-full"} aria-hidden />;
}

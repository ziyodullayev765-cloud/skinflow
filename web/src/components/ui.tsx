import clsx from "clsx";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { memo, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { fmt } from "../lib/format";
import { haptic } from "../lib/telegram";
import { playSound } from "../lib/sound";
import { useReducedMotion } from "../store/settings";
import { Icon } from "./Icon";

export function Button({
  variant = "primary",
  className,
  onClick,
  children,
  loading,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; loading?: boolean }) {
  return (
    <button
      type="button"
      className={clsx("btn", `btn-${variant}`, className)}
      onClick={(e) => {
        haptic.impact("light");
        playSound("tap");
        onClick?.(e);
      }}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("relative overflow-hidden rounded-xl bg-surface2", className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
}

export function CoinIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden>
      <defs>
        <linearGradient id="coin-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#f0a530" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="9" fill="url(#coin-g)" />
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="#9a5f10" strokeOpacity=".45" strokeWidth="1.3" />
      <path d="M10 6.2v7.6M8.2 8c0-.8.8-1.3 1.8-1.3s1.8.5 1.8 1.3-.7 1.1-1.8 1.4-1.8.7-1.8 1.5.8 1.3 1.8 1.3 1.8-.5 1.8-1.3" stroke="#7a4708" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Balance that counts smoothly to its new value. */
export const CoinAmount = memo(function CoinAmount({ value, className, size = 16 }: { value: number; className?: string; size?: number }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => fmt(v));
  const prev = useRef(value);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (prev.current === value) return;
    const up = value > prev.current;
    prev.current = value;
    if (reduced) {
      mv.set(value);
      return;
    }
    if (up) setBump((b) => b + 1);
    const c = animate(mv, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [value, reduced, mv]);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 tabular-nums", className)}>
      <motion.span key={bump} initial={bump ? { scale: 1.35, rotate: -20 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 14 }}>
        <CoinIcon size={size} />
      </motion.span>
      <motion.span>{text}</motion.span>
    </span>
  );
});

export function ProgressBar({ value, className, color }: { value: number; className?: string; color?: string }) {
  const reduced = useReducedMotion();
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-surface2", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color ?? "linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent-2)))" }}
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full bg-surface2 ring-1 ring-white/10" style={{ width: size, height: size }}>
      {src && !broken ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} referrerPolicy="no-referrer" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-accent/40 to-accent2/30 font-display font-semibold text-fg" style={{ fontSize: size * 0.42 }}>
          {initials}
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="section-title">{title}</h2>
      {action}
    </div>
  );
}

export function Toggle({ checked, onChange, label, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; icon?: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        haptic.select();
        onChange(!checked);
      }}
      className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left"
    >
      {icon && <Icon name={icon} size={20} className="text-muted" />}
      <span className="flex-1 text-[15px]">{label}</span>
      <span className={clsx("relative h-7 w-12 rounded-full transition-colors duration-200", checked ? "bg-accent" : "bg-surface2 ring-1 ring-white/10")}>
        <span className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200", checked ? "translate-x-6" : "translate-x-1")} />
      </span>
    </button>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface2 text-muted ring-1 ring-white/5">
        <Icon name={icon} size={26} />
      </div>
      <p className="font-display text-base font-semibold">{title}</p>
      {body && <p className="mt-1.5 max-w-xs text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

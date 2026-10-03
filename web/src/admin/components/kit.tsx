import clsx from "clsx";
import { motion } from "framer-motion";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { Skeleton } from "../../components/ui";
import { RARITY_HEX } from "../../lib/rarity";
import type { Rarity } from "../../lib/types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted/80">{hint}</span> : null}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx("input", p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx("input min-h-[88px] py-2.5", p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx("input appearance-none bg-[length:16px] pr-9", p.className)} />;

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl border hairline bg-surface2 p-1" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx("min-h-[36px] rounded-lg px-3.5 text-sm font-medium transition-colors", value === o.value ? "bg-surface text-fg shadow ring-1 ring-white/10" : "text-muted hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "accent", loading }: { label: string; value: ReactNode; icon: IconName; tone?: "accent" | "coin" | "success" | "accent2"; loading?: boolean }) {
  const toneCls = { accent: "bg-accent/12 text-accent", coin: "bg-coin/12 text-coin", success: "bg-success/12 text-success", accent2: "bg-accent2/12 text-accent2" }[tone];
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className={clsx("grid h-8 w-8 place-items-center rounded-lg", toneCls)}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      {loading ? <Skeleton className="mt-3 h-7 w-20" /> : <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>}
    </div>
  );
}

export const RARITY_UZ: Record<Rarity, string> = { common: "Oddiy", uncommon: "Noodatiy", rare: "Noyob", epic: "Epik", legendary: "Afsonaviy" };
export const ROLE_UZ: Record<string, string> = { owner: "Egasi", admin: "Admin", viewer: "Kuzatuvchi" };
export const PERIOD_UZ: Record<string, string> = { daily: "Kunlik", weekly: "Haftalik", once: "Bir martalik" };

export function RarityPill({ rarity }: { rarity: Rarity }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize" style={{ color: RARITY_HEX[rarity], background: `${RARITY_HEX[rarity]}1f` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: RARITY_HEX[rarity] }} />
      {RARITY_UZ[rarity] ?? rarity}
    </span>
  );
}

export function StatusPill({ active, on = "Faol", off = "Nofaol" }: { active: boolean; on?: string; off?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", active ? "bg-success/12 text-success" : "bg-white/5 text-muted")}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", active ? "bg-success" : "bg-muted")} />
      {active ? on : off}
    </span>
  );
}

export function IconButton({ icon, label, onClick, tone, disabled }: { icon: IconName; label: string; onClick: () => void; tone?: "danger"; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx("grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 disabled:opacity-40", tone === "danger" ? "hover:text-danger" : "hover:text-fg")}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

export function SuccessCheck({ label }: { label: string }) {
  return (
    <motion.div className="flex flex-col items-center py-6" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
        <motion.circle cx="36" cy="36" r="32" fill="none" stroke="rgb(var(--success))" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
        <motion.path d="M22 37l10 10 18-20" fill="none" stroke="rgb(var(--success))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.45 }} />
      </svg>
      <p className="mt-3 font-display text-lg font-semibold">{label}</p>
    </motion.div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "warn"; children: ReactNode }) {
  return (
    <div className={clsx("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm", tone === "error" ? "border-danger/30 bg-danger/10 text-danger" : tone === "warn" ? "border-coin/30 bg-coin/10 text-coin" : "border-accent/25 bg-accent/10 text-fg")}>
      <Icon name={tone === "info" ? "sparkle" : "alert"} size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

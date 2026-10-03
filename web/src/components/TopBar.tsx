import clsx from "clsx";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMe } from "../lib/queries";
import { Icon } from "./Icon";
import { CoinAmount, Skeleton } from "./ui";

export function BalancePill() {
  const me = useMe();
  if (!me.data) return <Skeleton className="h-9 w-24 rounded-full" />;
  return (
    <div className="flex h-9 items-center rounded-full border hairline bg-surface px-3 text-sm font-semibold" aria-label="Virtual coin balance">
      <CoinAmount value={me.data.coins} />
    </div>
  );
}

export function TopBar({ title, subtitle, back, onBack, right, className }: { title?: ReactNode; subtitle?: ReactNode; back?: boolean; onBack?: () => void; right?: ReactNode; className?: string }) {
  const navigate = useNavigate();
  const showBack = !!back;
  return (
    <header className={clsx("sticky top-0 z-30 safe-top", className)}>
      <div className="glass border-b hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4 lg:max-w-5xl">
          {showBack && (
            <button type="button" onClick={() => (onBack ? onBack() : window.history.length > 1 ? navigate(-1) : navigate("/"))} className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:text-fg" aria-label="Back">
              <Icon name="back" size={22} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {typeof title === "string" ? <h1 className="truncate font-display text-lg font-semibold tracking-tight">{title}</h1> : title}
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>
          {right ?? <BalancePill />}
        </div>
      </div>
    </header>
  );
}

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={clsx("mx-auto w-full px-4 pb-6 pt-4", wide ? "max-w-xl md:max-w-3xl lg:max-w-5xl" : "max-w-xl lg:max-w-5xl", className)}
    >
      {children}
    </motion.main>
  );
}

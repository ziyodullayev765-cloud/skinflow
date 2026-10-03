import clsx from "clsx";
import { motion } from "framer-motion";
import { memo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useT, type I18nKey } from "../lib/i18n";
import { haptic } from "../lib/telegram";
import { useReducedMotion } from "../store/settings";
import { Icon, type IconName } from "./Icon";

const TABS: { to: string; icon: IconName; label: I18nKey }[] = [
  { to: "/", icon: "home", label: "nav.home" },
  { to: "/cases", icon: "cases", label: "nav.cases" },
  { to: "/inventory", icon: "inventory", label: "nav.inventory" },
  { to: "/missions", icon: "missions", label: "nav.missions" },
  { to: "/profile", icon: "profile", label: "nav.profile" },
];

export const BottomNav = memo(function BottomNav({ badge }: { badge?: number }) {
  const t = useT();
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const activeIdx = TABS.findIndex((tab) => (tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to)));

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t hairline safe-bottom" aria-label="Main">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((tab, i) => {
          const active = i === activeIdx;
          return (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                replace
                onClick={() => !active && haptic.select()}
                className={clsx("relative flex h-[60px] flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors", active ? "text-fg" : "text-muted hover:text-fg/80")}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    layoutId={reduced ? undefined : "nav-indicator"}
                    className="absolute top-0 h-[2px] w-8 rounded-full"
                    style={{ background: "linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent-2)))" }}
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <motion.span animate={active && !reduced ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 26 }} className="relative">
                  <Icon name={tab.icon} size={22} strokeWidth={active ? 2 : 1.75} className={active ? "text-accent" : undefined} />
                  {tab.to === "/missions" && !!badge && (
                    <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{badge}</span>
                  )}
                </motion.span>
                <span>{t(tab.label)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});

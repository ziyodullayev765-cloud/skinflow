import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "../store/settings";
import { Icon } from "./Icon";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** "sheet" slides up from the bottom on mobile; "dialog" scales in centered. */
  variant?: "sheet" | "dialog";
  maxWidth?: string;
}

export function Sheet({ open, onClose, title, children, variant = "sheet", maxWidth = "28rem" }: Props) {
  const reduced = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => panel.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  const isSheet = variant === "sheet";
  const initial = reduced ? { opacity: 0 } : isSheet ? { y: "100%" } : { opacity: 0, scale: 0.94, y: 8 };
  const animate = reduced ? { opacity: 1 } : isSheet ? { y: 0 } : { opacity: 1, scale: 1, y: 0 };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative z-10 w-full overflow-hidden border hairline bg-surface outline-none ${isSheet ? "rounded-t-3xl sm:rounded-3xl safe-bottom" : "mx-4 rounded-3xl"}`}
            style={{ maxWidth, maxHeight: "88vh" }}
            initial={initial}
            animate={animate}
            exit={initial}
            transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 36 }}
          >
            {isSheet && <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />}
            {title && (
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <button type="button" onClick={onClose} className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:text-fg" aria-label="Close">
                  <Icon name="close" size={20} />
                </button>
              </div>
            )}
            <div className="max-h-[calc(88vh-64px)] overflow-y-auto px-5 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

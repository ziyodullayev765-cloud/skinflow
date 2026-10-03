import { AnimatePresence, motion } from "framer-motion";
import { useToasts } from "../store/ui";
import { Icon } from "./Icon";

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 safe-top" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 8, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="glass flex items-center gap-2.5 rounded-2xl border hairline px-4 py-3 text-sm shadow-lg shadow-black/30"
          >
            <Icon name={t.tone === "error" ? "alert" : t.tone === "success" ? "check" : "sparkle"} size={18} className={t.tone === "error" ? "text-danger" : t.tone === "success" ? "text-success" : "text-accent"} />
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

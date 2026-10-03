import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { Icon } from "../components/Icon";
import { Page, TopBar } from "../components/TopBar";
import { CoinIcon, Skeleton } from "../components/ui";
import { fmt } from "../lib/format";
import { useT } from "../lib/i18n";
import { useCases, useMe } from "../lib/queries";
import { RARITY_HEX } from "../lib/rarity";
import { haptic } from "../lib/telegram";

export default function Cases() {
  const t = useT();
  const navigate = useNavigate();
  const cases = useCases();
  const me = useMe();

  return (
    <>
      <TopBar title={t("cases.title")} subtitle={t("cases.subtitle")} />
      <Page wide>
        {cases.data && !cases.data.casesEnabled && (
          <div className="card mb-4 flex items-center gap-3 border-coin/30 p-3.5 text-sm">
            <Icon name="alert" size={18} className="text-coin" />
            {t("cases.unavailable")}
          </div>
        )}
        {cases.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-3xl" />
            ))}
          </div>
        ) : cases.isError ? (
          <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {cases.data!.cases.map((c, i) => {
              const affordable = (me.data?.coins ?? 0) >= c.cost;
              return (
                <motion.button
                  key={c.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    haptic.impact("light");
                    navigate(`/cases/${c.id}`);
                  }}
                  className="card group relative flex flex-col overflow-hidden p-3 text-left transition-colors hover:border-white/15"
                  aria-label={`${c.name}, ${c.cost} coins`}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-2/3 opacity-60 transition-opacity group-hover:opacity-90" style={{ background: `radial-gradient(70% 60% at 50% 40%, ${c.accent}33, transparent 70%)` }} />
                  {c.featured && (
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">★</span>
                  )}
                  <div className="relative mx-auto aspect-square w-[86%]">
                    <img src={c.image} alt="" loading={i < 4 ? "eager" : "lazy"} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]" />
                  </div>
                  <p className="relative mt-1 truncate font-display text-[15px] font-semibold">{c.name}</p>
                  <p className="relative text-[11px] text-muted">{t("cases.items", { count: c.itemCount })}</p>
                  <div className="relative mt-2 flex gap-1" aria-hidden>
                    {c.rarities.map((r) => (
                      <span key={r} className="h-1 flex-1 rounded-full" style={{ background: RARITY_HEX[r] }} />
                    ))}
                  </div>
                  <div className="relative mt-3 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${affordable ? "" : "text-muted"}`}>
                      <CoinIcon size={14} />
                      {fmt(c.cost)}
                    </span>
                    <span className="inline-flex h-8 items-center rounded-lg bg-surface2 px-2.5 text-xs font-semibold group-hover:bg-accent group-hover:text-[#0b0c0f]">
                      {t("cases.open")}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </Page>
    </>
  );
}

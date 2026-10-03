import clsx from "clsx";
import { motion } from "framer-motion";
import { useState } from "react";
import { countdown } from "../lib/format";
import { useNow } from "../lib/hooks";
import { useT } from "../lib/i18n";
import { useClaimDaily, useMe } from "../lib/queries";
import { playSound } from "../lib/sound";
import { haptic } from "../lib/telegram";
import { useToasts } from "../store/ui";
import { useErrorText } from "./ErrorState";
import { Icon } from "./Icon";
import { CoinIcon, Skeleton, Spinner } from "./ui";

export function DailyReward() {
  const t = useT();
  const me = useMe();
  const claim = useClaimDaily();
  const push = useToasts((s) => s.push);
  const errText = useErrorText();
  const now = useNow(1000);
  const [burst, setBurst] = useState(0);

  if (!me.data) return <Skeleton className="h-[72px] w-full rounded-2xl" />;
  const { claimed, amount, nextAt } = me.data.daily;

  const onClaim = () => {
    if (claimed || claim.isPending) return;
    haptic.impact("medium");
    claim.mutate(undefined, {
      onSuccess: (r) => {
        haptic.notify("success");
        playSound("achievement");
        setBurst((b) => b + 1);
        push(t("daily.toast", { amount: r.amount }), "success");
      },
      onError: (e) => {
        haptic.notify("error");
        push(errText(e).title, "error");
      },
    });
  };

  return (
    <motion.button
      type="button"
      onClick={onClaim}
      disabled={claimed || claim.isPending}
      whileTap={claimed ? undefined : { scale: 0.98 }}
      className={clsx(
        "card relative flex w-full items-center gap-3.5 overflow-hidden p-3.5 text-left transition-colors",
        !claimed && "border-coin/25 hover:border-coin/40",
      )}
    >
      {!claimed && <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-coin/[0.09] via-transparent to-transparent" />}
      <div className={clsx("relative grid h-11 w-11 shrink-0 place-items-center rounded-xl", claimed ? "bg-surface2 text-muted" : "bg-coin/15 text-coin")}>
        <Icon name={claimed ? "check" : "gift"} size={22} />
        {burst > 0 && (
          <motion.span key={burst} className="absolute inset-0 rounded-xl ring-2 ring-coin" initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.8 }} transition={{ duration: 0.7 }} />
        )}
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="text-sm font-semibold">{t("daily.title")}</p>
        <p className="truncate text-xs text-muted">{claimed ? `${t("daily.claimed")} · ${t("daily.next", { time: countdown(nextAt, now) })}` : `+${amount} ${t("common.coins")}`}</p>
      </div>
      {!claimed && (
        <span className="relative inline-flex h-9 items-center gap-1.5 rounded-full bg-coin px-3.5 text-sm font-semibold text-[#1a1203]">
          {claim.isPending ? <Spinner /> : <CoinIcon size={14} />}
          {t("daily.claim", { amount })}
        </span>
      )}
    </motion.button>
  );
}

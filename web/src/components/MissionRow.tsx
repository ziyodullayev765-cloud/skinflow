import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useT } from "../lib/i18n";
import { useClaimMission } from "../lib/queries";
import { playSound } from "../lib/sound";
import { haptic } from "../lib/telegram";
import type { Mission } from "../lib/types";
import { useToasts } from "../store/ui";
import { useErrorText } from "./ErrorState";
import { Icon, type IconName } from "./Icon";
import { CoinIcon, ProgressBar, Spinner } from "./ui";

const TYPE_ICON: Record<string, IconName> = {
  open_case: "cases",
  view_skins: "eye",
  claim_daily: "gift",
  complete_profile: "heart",
  login_streak: "flame",
};

const TYPE_ROUTE: Record<string, string> = {
  open_case: "/cases",
  view_skins: "/inventory",
  claim_daily: "/",
  complete_profile: "/inventory",
  login_streak: "/",
};

export function MissionRow({ mission }: { mission: Mission }) {
  const t = useT();
  const navigate = useNavigate();
  const claim = useClaimMission();
  const push = useToasts((s) => s.push);
  const errText = useErrorText();
  const ready = mission.completed && !mission.claimed;

  const onAction = () => {
    if (ready) {
      haptic.impact("medium");
      claim.mutate(mission.id, {
        onSuccess: (r) => {
          haptic.notify("success");
          playSound("achievement");
          push(`+${r.reward} ${t("common.coins")}`, "success");
        },
        onError: (e) => push(errText(e).title, "error"),
      });
    } else if (!mission.claimed) {
      haptic.select();
      navigate(TYPE_ROUTE[mission.type] ?? "/");
    }
  };

  return (
    <motion.div layout className={clsx("card flex items-center gap-3 p-3.5", ready && "border-success/30")}>
      <div className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", mission.claimed ? "bg-surface2 text-muted" : ready ? "bg-success/15 text-success" : "bg-accent/12 text-accent")}>
        <Icon name={mission.claimed ? "check" : TYPE_ICON[mission.type] ?? "missions"} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={clsx("truncate text-sm font-semibold", mission.claimed && "text-muted line-through decoration-white/20")}>{mission.title}</p>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-coin">
            <CoinIcon size={12} />+{mission.reward}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <ProgressBar value={mission.progress / mission.target} color={mission.completed ? "rgb(var(--success))" : undefined} />
          <span className="shrink-0 text-[11px] tabular-nums text-muted">
            {Math.min(mission.progress, mission.target)}/{mission.target}
          </span>
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {!mission.claimed && (
          <motion.button
            key={ready ? "claim" : "go"}
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={onAction}
            disabled={claim.isPending}
            className={clsx("grid h-11 min-w-[64px] place-items-center rounded-xl px-3 text-sm font-semibold", ready ? "bg-success text-[#06140c]" : "bg-surface2 text-fg")}
          >
            {claim.isPending ? <Spinner /> : ready ? t("missions.claim") : t("missions.go")}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

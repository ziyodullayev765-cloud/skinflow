import { ErrorState } from "../components/ErrorState";
import { MissionRow } from "../components/MissionRow";
import { Page, TopBar } from "../components/TopBar";
import { CoinIcon, Skeleton } from "../components/ui";
import { countdown, nextUtcMidnightIso, nextUtcMondayIso } from "../lib/format";
import { useNow } from "../lib/hooks";
import { useT, type I18nKey } from "../lib/i18n";
import { useMissions } from "../lib/queries";
import type { Mission } from "../lib/types";
import { DailyReward } from "../components/DailyReward";
import { PromoCard } from "../components/PromoCard";

export default function Missions() {
  const t = useT();
  const missions = useMissions();
  const now = useNow(1000);

  const groups: { key: Mission["period"]; label: I18nKey; resetAt?: string }[] = [
    { key: "daily", label: "missions.daily", resetAt: nextUtcMidnightIso() },
    { key: "weekly", label: "missions.weekly", resetAt: nextUtcMondayIso() },
    { key: "once", label: "missions.once" },
  ];
  const earnable = (missions.data ?? []).filter((m) => !m.claimed).reduce((s, m) => s + m.reward, 0);

  return (
    <>
      <TopBar title={t("missions.title")} subtitle={t("missions.subtitle")} />
      <Page className="space-y-6">
        <DailyReward />
        <PromoCard />
        {missions.isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-2xl" />
            ))}
          </div>
        ) : missions.isError ? (
          <ErrorState error={missions.error} onRetry={() => void missions.refetch()} />
        ) : (
          <>
            {earnable > 0 && (
              <div className="card flex items-center justify-between p-4">
                <span className="text-sm text-muted">{t("missions.subtitle")}</span>
                <span className="inline-flex items-center gap-1 font-display text-lg font-bold tabular-nums text-coin">
                  <CoinIcon size={16} />
                  {earnable}
                </span>
              </div>
            )}
            {groups.map((g) => {
              const list = missions.data!.filter((m) => m.period === g.key);
              if (!list.length) return null;
              return (
                <section key={g.key}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="section-title">{t(g.label)}</h2>
                    {g.resetAt && <span className="text-xs tabular-nums text-muted">{t("missions.resets", { time: countdown(g.resetAt, now) })}</span>}
                  </div>
                  <div className="space-y-2.5">
                    {list.map((m) => (
                      <MissionRow key={m.id} mission={m} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </Page>
    </>
  );
}

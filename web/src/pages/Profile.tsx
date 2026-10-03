import clsx from "clsx";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { Icon, type IconName } from "../components/Icon";
import { SkinCard } from "../components/Skin";
import { Page, TopBar } from "../components/TopBar";
import { Avatar, ProgressBar, SectionHeader, Skeleton } from "../components/ui";
import { fmt, timeAgo } from "../lib/format";
import { useT } from "../lib/i18n";
import { useOpenings, useProfile } from "../lib/queries";
import { RARITIES, RARITY_HEX } from "../lib/rarity";

const ACH_ICON: Record<string, IconName> = {
  "first-drop": "cases",
  "ten-openings": "bolt",
  "fifty-openings": "flame",
  "first-epic": "sparkle",
  "first-legendary": "trophy",
  "collector-15": "inventory",
  "full-collection": "check",
  "streak-7": "flame",
};

export default function Profile() {
  const t = useT();
  const navigate = useNavigate();
  const profile = useProfile();
  const history = useOpenings(5);

  if (profile.isLoading)
    return (
      <>
        <TopBar title={t("profile.title")} />
        <Page>
          <Skeleton className="h-36 w-full rounded-3xl" />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </Page>
      </>
    );
  if (profile.isError || !profile.data)
    return (
      <>
        <TopBar title={t("profile.title")} />
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </>
    );

  const p = profile.data;
  const u = p.user;
  const levelProgress = (u.xp - u.levelXp) / Math.max(1, u.nextLevelXp - u.levelXp);
  const stats = [
    { label: t("profile.totalSkins"), value: fmt(u.totalSkins) },
    { label: t("profile.completion"), value: `${Math.round(p.collectionCompletion * 100)}%` },
    { label: t("profile.openings"), value: fmt(u.totalOpenings) },
    { label: t("profile.missionsDone"), value: fmt(p.missionsCompleted) },
  ];
  const rarityTotal = RARITIES.reduce((s, r) => s + (p.rarityCounts[r] ?? 0), 0);

  return (
    <>
      <TopBar
        title={t("profile.title")}
        right={
          <Link to="/profile/settings" className="grid h-11 w-11 place-items-center rounded-full text-muted hover:text-fg" aria-label={t("profile.settings")}>
            <Icon name="settings" size={21} />
          </Link>
        }
      />
      <Page wide className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border hairline bg-surface p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_0%_0%,rgb(var(--accent)/0.16),transparent_60%)]" />
          <div className="relative flex items-center gap-4">
            <Avatar src={u.avatarUrl} name={u.firstName} size={64} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-bold">{u.firstName}</p>
              <p className="truncate text-sm text-muted">{u.username ? `@${u.username}` : u.isGuest ? "Guest" : ""}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">{t("profile.level", { level: u.level })}</span>
                {u.streakDays > 1 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-coin/12 px-2 py-0.5 font-semibold text-coin">
                    <Icon name="flame" size={12} />
                    {t("profile.streak", { days: u.streakDays })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="relative mt-4">
            <ProgressBar value={levelProgress} />
            <p className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
              <span>{fmt(u.xp)} XP</span>
              <span>{fmt(u.nextLevelXp)} XP</span>
            </p>
          </div>
          {u.isGuest && <p className="relative mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-muted">{t("profile.guest")}</p>}
        </section>

        <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} className="card p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <p className="font-display text-2xl font-bold tabular-nums">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted">{s.label}</p>
            </motion.div>
          ))}
        </section>

        {rarityTotal > 0 && (
          <section className="card p-4">
            <div className="flex h-2 overflow-hidden rounded-full">
              {RARITIES.map((r) => (p.rarityCounts[r] ? <span key={r} style={{ width: `${((p.rarityCounts[r] ?? 0) / rarityTotal) * 100}%`, background: RARITY_HEX[r] }} /> : null))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {RARITIES.map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: RARITY_HEX[r] }} />
                  {t(`rarity.${r}`)} <b className="font-semibold text-fg">{p.rarityCounts[r] ?? 0}</b>
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <SectionHeader title={t("profile.favorite")} />
            {p.favoriteSkin ? (
              <div className="max-w-[260px]">
                <SkinCard skin={p.favoriteSkin} favorite onClick={() => navigate(`/inventory/${p.favoriteSkin!.id}`)} />
              </div>
            ) : (
              <p className="card px-4 py-5 text-sm text-muted">{t("profile.noFavorite")}</p>
            )}
          </section>

          <section>
            <SectionHeader title={t("profile.achievements")} />
            <div className="grid grid-cols-4 gap-2.5">
              {p.achievements.map((a) => (
                <div key={a.code} className={clsx("card flex flex-col items-center gap-1.5 px-1.5 py-3 text-center", !a.unlocked && "opacity-40")} title={a.description}>
                  <div className={clsx("grid h-10 w-10 place-items-center rounded-xl", a.unlocked ? "bg-gradient-to-br from-coin/30 to-coin/5 text-coin" : "bg-surface2 text-muted")}>
                    <Icon name={a.unlocked ? ACH_ICON[a.code] ?? "trophy" : "lock"} size={19} />
                  </div>
                  <p className="line-clamp-2 text-[10.5px] font-medium leading-tight">{a.title}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section>
          <SectionHeader
            title={t("profile.history")}
            action={
              <Link to="/profile/history" className="text-xs font-medium text-muted hover:text-fg">
                {t("home.seeAll")}
              </Link>
            }
          />
          <div className="card divide-y divide-white/[0.06]">
            {(history.data?.pages[0]?.openings ?? []).length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">{t("history.empty")}</p>
            ) : (
              history.data!.pages[0].openings.map((o) => (
                <Link key={o.id} to={`/inventory/${o.skin.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
                  <span className="h-8 w-1 rounded-full" style={{ background: RARITY_HEX[o.skin.rarity] }} />
                  <img src={o.skin.thumbnail} alt="" className="h-9 w-14 object-contain" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.skin.name}</p>
                    <p className="truncate text-xs text-muted">{o.caseName}</p>
                  </div>
                  <span className="text-xs text-muted">{timeAgo(o.createdAt)}</span>
                </Link>
              ))
            )}
          </div>
        </section>

        <nav className="card divide-y divide-white/[0.06]">
          {[
            { to: "/collections", icon: "grid" as IconName, label: t("profile.collections") },
            { to: "/profile/history", icon: "history" as IconName, label: t("profile.history") },
            { to: "/profile/settings", icon: "settings" as IconName, label: t("profile.settings") },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="flex min-h-[52px] items-center gap-3 px-4">
              <Icon name={l.icon} size={20} className="text-muted" />
              <span className="flex-1 text-[15px]">{l.label}</span>
              <Icon name="chevron" size={18} className="text-muted" />
            </Link>
          ))}
        </nav>
      </Page>
    </>
  );
}

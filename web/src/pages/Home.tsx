import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { DailyReward } from "../components/DailyReward";
import { ErrorState } from "../components/ErrorState";
import { Icon } from "../components/Icon";
import { MissionRow } from "../components/MissionRow";
import { Particles } from "../components/Particles";
import { SkinCard, SkinImage } from "../components/Skin";
import { BalancePill, Page } from "../components/TopBar";
import { Avatar, CoinIcon, ProgressBar, SectionHeader, Skeleton } from "../components/ui";
import { fmt, timeAgo } from "../lib/format";
import { useT } from "../lib/i18n";
import { useCases, useFeatured, useInventory, useMe, useMissions, useOpenings, useProfile } from "../lib/queries";
import { haptic } from "../lib/telegram";

function Greeting() {
  const t = useT();
  const me = useMe();
  const h = new Date().getHours();
  const greet = h < 12 ? t("home.greeting.morning") : h < 18 ? t("home.greeting.afternoon") : t("home.greeting.evening");
  return (
    <header className="safe-top sticky top-0 z-30">
      <div className="glass border-b hairline">
        <div className="mx-auto flex h-16 max-w-xl items-center gap-3 px-4 lg:max-w-5xl">
          {me.data ? (
            <Link to="/profile" aria-label="Profile">
              <Avatar src={me.data.avatarUrl} name={me.data.firstName} size={40} />
            </Link>
          ) : (
            <Skeleton className="h-10 w-10 rounded-full" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{greet}</p>
            {me.data ? <p className="truncate font-display text-[15px] font-semibold">{me.data.firstName}</p> : <Skeleton className="mt-1 h-4 w-24" />}
          </div>
          <BalancePill />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const t = useT();
  const navigate = useNavigate();
  const cases = useCases();
  const featured = cases.data?.cases.find((c) => c.featured) ?? cases.data?.cases[0];

  return (
    <section className="relative overflow-hidden rounded-3xl border hairline bg-surface">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgb(var(--accent)/0.20),transparent_60%),radial-gradient(90%_70%_at_0%_100%,rgb(var(--accent-2)/0.12),transparent_60%)]" />
      <Particles count={22} />
      <div className="relative flex items-center gap-2 p-5 sm:p-7">
        <div className="min-w-0 flex-1">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            <Icon name="sparkle" size={12} className="text-accent" />
            {featured ? t("home.featured") : "SkinFlow"}
          </p>
          <h1 className="font-display text-[26px] font-bold leading-[1.05] tracking-tight xs:text-[28px] sm:text-4xl">{t("home.hero.title")}</h1>
          <p className="mt-2 max-w-[22ch] text-[13px] leading-snug text-muted sm:text-sm">{t("home.hero.subtitle")}</p>
          <button
            type="button"
            className="btn btn-primary mt-5 px-5 text-[13px] tracking-wider"
            onClick={() => {
              haptic.impact("medium");
              navigate(featured ? `/cases/${featured.id}` : "/cases");
            }}
          >
            {t("home.hero.cta")}
            <Icon name="chevron" size={16} strokeWidth={2.4} />
          </button>
        </div>
        <div className="relative -mr-2 w-[38%] max-w-[180px] shrink-0">
          {featured ? (
            <motion.img
              src={featured.image}
              alt={featured.name}
              className="w-full animate-floaty drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            />
          ) : (
            <Skeleton className="aspect-square w-full rounded-3xl" />
          )}
          {featured && (
            <span className="absolute bottom-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              <CoinIcon size={12} />
              {fmt(featured.cost)}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturedSkins() {
  const t = useT();
  const navigate = useNavigate();
  const featured = useFeatured();
  const skins = featured.data ?? [];
  if (!featured.isLoading && skins.length === 0) return null;
  return (
    <section>
      <SectionHeader title={t("home.featuredSkins")} />
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {featured.isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[150px] w-[168px] shrink-0 rounded-2xl" />)
          : skins.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(s.caseId ? `/cases/${s.caseId}` : "/cases")}
                className={`rarity-${s.rarity} card relative w-[168px] shrink-0 overflow-hidden p-2.5 text-left`}
              >
                <div className="rarity-glow absolute inset-0" />
                <div className="shine-sweep" />
                <SkinImage src={s.thumbnail} alt="" className="relative h-[72px]" />
                <div className="rarity-bar my-2 h-px" />
                <p className="relative truncate text-[10.5px] uppercase tracking-wider text-muted">{s.weaponName}</p>
                <p className="relative truncate text-[13px] font-semibold">{s.name}</p>
                <p className="relative mt-1 flex items-center justify-between text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <CoinIcon size={11} />
                    {fmt(s.virtualPrice)}
                  </span>
                  {s.caseName && <span className="truncate pl-2">{s.caseName}</span>}
                </p>
              </button>
            ))}
      </div>
    </section>
  );
}

function RecentDrops() {
  const t = useT();
  const navigate = useNavigate();
  const openings = useOpenings(8);
  const rows = openings.data?.pages[0]?.openings ?? [];
  return (
    <section>
      <SectionHeader
        title={t("home.recent")}
        action={
          <Link to="/profile/history" className="text-xs font-medium text-muted hover:text-fg">
            {t("home.seeAll")}
          </Link>
        }
      />
      {openings.isLoading ? (
        <div className="flex gap-2.5 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] w-[132px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : openings.isError ? (
        <ErrorState compact error={openings.error} onRetry={() => void openings.refetch()} />
      ) : rows.length === 0 ? (
        <p className="card px-4 py-5 text-center text-sm text-muted">{t("home.noDrops")}</p>
      ) : (
        <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
          {rows.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => navigate(`/inventory/${o.skin.id}`)}
              className={`rarity-${o.skin.rarity} card relative w-[132px] shrink-0 overflow-hidden p-2 text-left`}
            >
              <div className="rarity-glow absolute inset-0" />
              <SkinImage src={o.skin.thumbnail} alt="" className="relative h-14" />
              <div className="rarity-bar my-1.5 h-px" />
              <p className="relative truncate text-[12px] font-semibold">{o.skin.name}</p>
              <p className="relative flex justify-between text-[10.5px] text-muted">
                <span className="truncate">{o.skin.weaponName}</span>
                <span>{timeAgo(o.createdAt)}</span>
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CollectionProgress() {
  const t = useT();
  const profile = useProfile();
  if (profile.isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (!profile.data) return null;
  const p = profile.data;
  return (
    <Link to="/collections" className="card block p-4 transition-colors hover:border-white/15">
      <div className="flex items-baseline justify-between">
        <p className="section-title">{t("home.progress")}</p>
        <p className="font-display text-xl font-bold tabular-nums">{Math.round(p.collectionCompletion * 100)}%</p>
      </div>
      <ProgressBar value={p.collectionCompletion} className="mt-3" />
      <div className="mt-3 flex gap-1.5">
        {p.collections.map((c) => (
          <div key={c.collection} className="flex-1" title={`${c.collection}: ${c.owned}/${c.total}`}>
            <div className="h-1 overflow-hidden rounded-full bg-surface2">
              <div className="h-full rounded-full bg-accent2/70" style={{ width: `${(c.owned / Math.max(1, c.total)) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{t("collection.owned", { owned: p.ownedCatalog, total: p.totalCatalog })}</p>
    </Link>
  );
}

function DailyMissions() {
  const t = useT();
  const missions = useMissions();
  const daily = missions.data?.filter((m) => m.period === "daily").slice(0, 3) ?? [];
  return (
    <section>
      <SectionHeader
        title={t("home.missions")}
        action={
          <Link to="/missions" className="text-xs font-medium text-muted hover:text-fg">
            {t("home.seeAll")}
          </Link>
        }
      />
      {missions.isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : missions.isError ? (
        <ErrorState compact error={missions.error} onRetry={() => void missions.refetch()} />
      ) : (
        <div className="space-y-2.5">
          {daily.map((m) => (
            <MissionRow key={m.id} mission={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function InventoryPreview() {
  const t = useT();
  const navigate = useNavigate();
  const inv = useInventory();
  const items = [...(inv.data ?? [])].sort((a, b) => b.skin.virtualPrice - a.skin.virtualPrice).slice(0, 4);
  if (!inv.isLoading && items.length === 0) return null;
  return (
    <section>
      <SectionHeader
        title={t("home.inventory")}
        action={
          <Link to="/inventory" className="text-xs font-medium text-muted hover:text-fg">
            {t("home.seeAll")}
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {inv.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)
          : items.map((i) => <SkinCard key={i.id} skin={i.skin} quantity={i.quantity} favorite={i.favorite} compact onClick={() => navigate(`/inventory/${i.skin.id}`)} />)}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Greeting />
      <Page className="space-y-6">
        <Hero />
        <DailyReward />
        <FeaturedSkins />
        <RecentDrops />
        <div className="grid gap-6 lg:grid-cols-2">
          <CollectionProgress />
          <DailyMissions />
        </div>
        <InventoryPreview />
      </Page>
    </>
  );
}

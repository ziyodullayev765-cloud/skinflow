import clsx from "clsx";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { Icon } from "../components/Icon";
import { RarityBadge, SkinImage } from "../components/Skin";
import { Page, TopBar } from "../components/TopBar";
import { Button, CoinIcon, Skeleton } from "../components/ui";
import { fmt, shortDate } from "../lib/format";
import { useTelegramBack } from "../lib/hooks";
import { useT } from "../lib/i18n";
import { useInventoryItem, useToggleFavorite } from "../lib/queries";
import { playSound } from "../lib/sound";
import { haptic } from "../lib/telegram";
import { useSettings } from "../store/settings";
import { useInventoryFilters } from "../store/ui";

export default function SkinDetail() {
  const t = useT();
  const lang = useSettings((s) => s.language);
  const navigate = useNavigate();
  const skinId = Number(useParams().skinId);
  const item = useInventoryItem(skinId);
  const fav = useToggleFavorite();
  const setFilters = useInventoryFilters((s) => s.set);
  useTelegramBack();

  if (item.isLoading && !item.data)
    return (
      <>
        <TopBar back title="" />
        <Page>
          <Skeleton className="aspect-[16/10] w-full rounded-3xl" />
          <Skeleton className="mt-5 h-7 w-2/3" />
          <Skeleton className="mt-3 h-24 w-full rounded-2xl" />
        </Page>
      </>
    );
  if (item.isError && !item.data)
    return (
      <>
        <TopBar back title={t("detail.back")} />
        <ErrorState error={item.error} onRetry={() => void item.refetch()} />
      </>
    );

  const it = item.data!;
  const s = it.skin;

  const rows: [string, React.ReactNode][] = [
    [t("detail.weapon"), `${s.weaponName} · ${t(`weapon.${s.weaponType}`)}`],
    [t("detail.collection"), s.collection],
    [t("detail.value"), <span key="v" className="inline-flex items-center gap-1 tabular-nums"><CoinIcon size={13} />{fmt(s.virtualPrice)}</span>],
    [t("detail.acquired"), shortDate(it.acquiredAt, lang)],
    [t("detail.owned"), `×${it.quantity}`],
  ];

  return (
    <>
      <TopBar back title={s.name} subtitle={s.weaponName} />
      <Page wide>
        <div className="lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-start lg:gap-10">
          <motion.section
            className={`rarity-${s.rarity} relative overflow-hidden rounded-3xl border hairline bg-surface`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div className="rarity-glow absolute inset-0" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:24px_24px]" />
            {s.rarity !== "common" && <div className="shine-sweep" />}
            <SkinImage src={s.image} alt={`${s.weaponName} ${s.name}`} eager className="relative mx-auto aspect-[16/10] w-[92%]" />
            <div className="rarity-bar h-[2px]" />
          </motion.section>

          <section className="mt-5 lg:mt-0">
            <RarityBadge rarity={s.rarity} />
            <h1 className="mt-2 font-display text-[26px] font-bold leading-tight tracking-tight">{s.name}</h1>
            <p className="text-sm text-muted">{s.weaponName}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-fg/85">{s.description}</p>

            <dl className="card mt-5 divide-y divide-white/[0.06]">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-muted">{t("detail.noValue")}</p>

            <div className="mt-5 grid grid-cols-[auto_1fr_1fr] gap-2.5">
              <Button variant="secondary" onClick={() => navigate(-1)} aria-label={t("detail.back")} className="px-3.5">
                <Icon name="back" size={18} />
              </Button>
              <Button
                variant="secondary"
                className={clsx(it.favorite && "border-[#ff7fa8]/40 text-[#ff7fa8]")}
                onClick={() => {
                  haptic.impact("light");
                  if (!it.favorite) playSound("reveal");
                  fav.mutate({ skinId: s.id, favorite: !it.favorite });
                }}
                aria-pressed={it.favorite}
              >
                <motion.span key={String(it.favorite)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
                  <Icon name="heart" size={18} filled={it.favorite} />
                </motion.span>
                {it.favorite ? t("detail.unfavorite") : t("detail.favorite")}
              </Button>
              <Button
                onClick={() => {
                  setFilters({ collection: s.collection });
                  navigate(`/collections#${encodeURIComponent(s.collection)}`);
                }}
              >
                <Icon name="grid" size={18} />
                {t("detail.viewCollection")}
              </Button>
            </div>
          </section>
        </div>
      </Page>
    </>
  );
}

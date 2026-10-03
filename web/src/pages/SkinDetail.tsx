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
import { useInventoryItem, useSellSkin, useToggleFavorite } from "../lib/queries";
import { useState } from "react";
import { Sheet } from "../components/Sheet";
import { useToasts } from "../store/ui";
import { useErrorText } from "../components/ErrorState";
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
  const sell = useSellSkin();
  const push = useToasts((x) => x.push);
  const errText = useErrorText();
  const [sellOpen, setSellOpen] = useState(false);
  const [sellQty, setSellQty] = useState(1);
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

            <Button
              variant="secondary"
              className="mt-5 w-full border-coin/30 text-coin"
              onClick={() => {
                setSellQty(1);
                if (it.quantity > 1) setSellOpen(true);
                else doSell(1);
              }}
              loading={sell.isPending}
            >
              <CoinIcon size={16} />
              {t("sell.button", { amount: fmt(s.virtualPrice) })}
            </Button>

            <div className="mt-2.5 grid grid-cols-[auto_1fr_1fr] gap-2.5">
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

      <Sheet open={sellOpen} onClose={() => setSellOpen(false)} title={t("sell.title")}>
        <div className="space-y-4">
          <p className="text-sm text-muted">{s.weaponName} | {s.name}</p>
          <div className="flex items-center justify-between rounded-2xl bg-surface2 p-2">
            <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-xl" onClick={() => setSellQty((q) => Math.max(1, q - 1))} aria-label="-">−</button>
            <div className="text-center">
              <p className="font-display text-2xl font-bold tabular-nums">{sellQty}</p>
              <p className="text-[11px] text-muted">{t("sell.quantity")} · max {it.quantity}</p>
            </div>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-xl" onClick={() => setSellQty((q) => Math.min(it.quantity, q + 1))} aria-label="+">+</button>
          </div>
          <button type="button" className="text-xs text-accent" onClick={() => setSellQty(it.quantity)}>max ×{it.quantity}</button>
          <Button className="w-full" loading={sell.isPending} onClick={() => doSell(sellQty)}>
            <CoinIcon size={16} />
            {t("sell.confirm", { count: sellQty, amount: fmt(sellQty * s.virtualPrice) })}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted">{t("sell.note")}</p>
        </div>
      </Sheet>
    </>
  );

  function doSell(quantity: number) {
    sell.mutate(
      { skinId: s.id, quantity },
      {
        onSuccess: (r) => {
          haptic.notify("success");
          playSound("achievement");
          push(t("sell.done", { amount: fmt(r.earned) }), "success");
          setSellOpen(false);
          if (r.remaining <= 0) navigate("/inventory", { replace: true });
        },
        onError: (e) => push(errText(e).title, "error"),
      },
    );
  }
}

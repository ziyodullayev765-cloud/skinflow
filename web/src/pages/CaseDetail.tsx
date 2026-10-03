import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CaseOpening } from "../components/CaseOpening";
import { ErrorState, useErrorText } from "../components/ErrorState";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { SkinImage } from "../components/Skin";
import { Page, TopBar } from "../components/TopBar";
import { Button, CoinIcon, Skeleton } from "../components/ui";
import { fmt, pct } from "../lib/format";
import { useTelegramBack, useTelegramMainButton } from "../lib/hooks";
import { useT } from "../lib/i18n";
import { useCase, useCases, useMe } from "../lib/queries";
import { RARITIES, RARITY_HEX } from "../lib/rarity";
import type { ApiError } from "../lib/api";
import { Link } from "react-router-dom";

export default function CaseDetail() {
  const t = useT();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const kase = useCase(id);
  const cases = useCases();
  const me = useMe();
  const errText = useErrorText();
  const [opening, setOpening] = useState(false);
  const [blocked, setBlocked] = useState<ApiError | null>(null);
  useTelegramBack(() => navigate("/cases"));

  const c = kase.data;
  const casesEnabled = cases.data?.casesEnabled ?? true;
  const insufficient = !!c && !!me.data && me.data.coins < c.cost;

  const start = () => {
    if (!c || opening) return;
    setOpening(true);
  };
  const nativeMain = useTelegramMainButton(c && !opening && casesEnabled && !insufficient ? t("cases.openFor", { cost: fmt(c.cost) }) : null, start);

  if (kase.isLoading)
    return (
      <>
        <TopBar back title="" />
        <Page>
          <Skeleton className="mx-auto aspect-square w-2/3 rounded-3xl" />
          <Skeleton className="mt-6 h-12 w-full rounded-xl" />
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
            ))}
          </div>
        </Page>
      </>
    );
  if (kase.isError || !c)
    return (
      <>
        <TopBar back title={t("cases.title")} />
        <ErrorState error={kase.error} onRetry={() => void kase.refetch()} />
      </>
    );

  return (
    <>
      <TopBar back title={c.name} subtitle={t("cases.items", { count: c.itemCount })} />
      <Page wide className="pb-28">
        <div className="lg:grid lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-10">
          <section className="relative">
            <div className="pointer-events-none absolute inset-0 -z-0" style={{ background: `radial-gradient(55% 50% at 50% 45%, ${c.accent}40, transparent 70%)` }} />
            <img src={c.image} alt={c.name} className="relative mx-auto aspect-square w-[64%] max-w-[300px] animate-floaty object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.6)]" />
            <p className="relative mx-auto mt-2 max-w-sm text-center text-sm text-muted">{c.description}</p>

            {!nativeMain && (
              <div className="relative mt-5">
                <Button className="w-full text-[15px] tracking-wide" disabled={!casesEnabled || insufficient || opening} onClick={start}>
                  <CoinIcon size={16} />
                  {t("cases.openFor", { cost: fmt(c.cost) })}
                </Button>
              </div>
            )}
            {insufficient && (
              <div className="card mt-3 flex items-start gap-3 p-3.5 text-sm">
                <Icon name="coin" size={18} className="mt-0.5 shrink-0 text-coin" />
                <div>
                  <p className="font-semibold">{t("err.INSUFFICIENT_COINS.title")}</p>
                  <p className="text-muted">{t("err.INSUFFICIENT_COINS.body")}</p>
                  <div className="mt-2 flex gap-3 text-xs font-semibold">
                    <Link to="/" className="text-accent">{t("daily.title")} →</Link>
                    <Link to="/missions" className="text-accent">{t("missions.title")} →</Link>
                  </div>
                </div>
              </div>
            )}
            {!casesEnabled && <p className="mt-3 text-center text-sm text-muted">{t("cases.unavailable")}</p>}

            <div className="card mt-6 p-4">
              <p className="label mb-3">{t("cases.odds")}</p>
              <div className="flex h-2 overflow-hidden rounded-full">
                {RARITIES.filter((r) => c.rarityOdds[r]).map((r) => (
                  <span key={r} style={{ width: `${(c.rarityOdds[r] ?? 0) * 100}%`, background: RARITY_HEX[r] }} />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                {RARITIES.filter((r) => c.rarityOdds[r]).map((r) => (
                  <li key={r} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: RARITY_HEX[r] }} />
                      {t(`rarity.${r}`)}
                    </span>
                    <span className="tabular-nums text-muted">{pct(c.rarityOdds[r] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mt-6 lg:mt-0">
            <p className="label mb-3">{t("cases.contents")}</p>
            <div className="grid grid-cols-2 gap-2.5 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
              {c.items.map((s) => (
                <div key={s.id} className={`rarity-${s.rarity} card relative overflow-hidden p-2.5`}>
                  <div className="rarity-glow absolute inset-0" />
                  <SkinImage src={s.thumbnail} alt="" className="relative aspect-[16/10]" />
                  <div className="rarity-bar my-2 h-px" />
                  <p className="relative truncate text-[10.5px] uppercase tracking-wider text-muted">{s.weaponName}</p>
                  <p className="relative truncate text-[13px] font-semibold">{s.name}</p>
                  <p className="relative mt-0.5 text-[11px] tabular-nums" style={{ color: "rgb(var(--rc))" }}>
                    {pct(s.probability)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Page>

      {opening && (
        <CaseOpening
          kase={c}
          onClose={() => setOpening(false)}
          onError={(e) => {
            setOpening(false);
            setBlocked(e);
          }}
        />
      )}

      <Sheet open={!!blocked} onClose={() => setBlocked(null)} variant="dialog" maxWidth="22rem">
        {blocked && (
          <div className="pt-4 text-center">
            <ErrorState compact error={blocked} />
            <p className="sr-only">{errText(blocked).body}</p>
            <Button className="w-full" onClick={() => setBlocked(null)}>
              OK
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

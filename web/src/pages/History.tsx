import { ErrorState } from "../components/ErrorState";
import { RarityBadge } from "../components/Skin";
import { Page, TopBar } from "../components/TopBar";
import { Button, CoinIcon, EmptyState, Skeleton } from "../components/ui";
import { fmt, shortDate } from "../lib/format";
import { useTelegramBack } from "../lib/hooks";
import { useT } from "../lib/i18n";
import { useOpenings } from "../lib/queries";
import { RARITY_HEX } from "../lib/rarity";
import { useSettings } from "../store/settings";
import { Link } from "react-router-dom";

export default function History() {
  const t = useT();
  const lang = useSettings((s) => s.language);
  const q = useOpenings(20);
  useTelegramBack();
  const rows = q.data?.pages.flatMap((p) => p.openings) ?? [];

  return (
    <>
      <TopBar back title={t("history.title")} />
      <Page>
        {q.isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon="history" title={t("history.empty")} />
        ) : (
          <>
            <ul className="space-y-2">
              {rows.map((o) => (
                <li key={o.id}>
                  <Link to={`/inventory/${o.skin.id}`} className="card flex min-h-[64px] items-center gap-3 p-2.5 pr-3.5">
                    <div className="relative grid h-12 w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl bg-surface2">
                      <span className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: RARITY_HEX[o.skin.rarity] }} />
                      <img src={o.skin.thumbnail} alt="" className="h-10 w-16 object-contain" loading="lazy" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {o.skin.weaponName} | {o.skin.name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {o.caseName} · {shortDate(o.createdAt, lang)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <RarityBadge rarity={o.skin.rarity} className="hidden xs:inline-flex" />
                      <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted">
                        −<CoinIcon size={11} />
                        {fmt(o.cost)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {q.hasNextPage && (
              <Button variant="secondary" className="mt-4 w-full" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                {t("history.more")}
              </Button>
            )}
          </>
        )}
      </Page>
    </>
  );
}

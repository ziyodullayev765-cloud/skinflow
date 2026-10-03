import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { SkinCard } from "../components/Skin";
import { Page, TopBar } from "../components/TopBar";
import { ProgressBar, Skeleton } from "../components/ui";
import { useTelegramBack } from "../lib/hooks";
import { useT } from "../lib/i18n";
import { useCollections } from "../lib/queries";

export default function Collections() {
  const t = useT();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const cols = useCollections();
  useTelegramBack();

  useEffect(() => {
    if (!hash || !cols.data) return;
    const el = document.getElementById(`col-${decodeURIComponent(hash.slice(1))}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, cols.data]);

  return (
    <>
      <TopBar back title={t("collection.title")} />
      <Page wide className="space-y-8">
        {cols.isLoading ? (
          <Skeleton className="h-64 w-full rounded-3xl" />
        ) : cols.isError ? (
          <ErrorState error={cols.error} onRetry={() => void cols.refetch()} />
        ) : (
          cols.data!.map((c) => (
            <section key={c.name} id={`col-${c.name}`} className="scroll-mt-24">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">{c.name}</h2>
                  <p className="text-xs text-muted">{t("collection.owned", { owned: c.owned, total: c.total })}</p>
                </div>
                <span className="font-display text-lg font-bold tabular-nums">{Math.round((c.owned / Math.max(1, c.total)) * 100)}%</span>
              </div>
              <ProgressBar value={c.owned / Math.max(1, c.total)} className="mb-4" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {c.skins.map((s) => (
                  <SkinCard key={s.id} skin={s} quantity={s.quantity} locked={!s.owned} onClick={s.owned ? () => navigate(`/inventory/${s.id}`) : undefined} />
                ))}
              </div>
            </section>
          ))
        )}
      </Page>
    </>
  );
}

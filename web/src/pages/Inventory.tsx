import { useWindowVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { SkinCard } from "../components/Skin";
import { Page, TopBar } from "../components/TopBar";
import { Button, EmptyState, Skeleton } from "../components/ui";
import { useT } from "../lib/i18n";
import { useInventory } from "../lib/queries";
import { RARITIES, RARITY_HEX, RARITY_RANK, WEAPONS } from "../lib/rarity";
import { haptic } from "../lib/telegram";
import type { InventoryItem } from "../lib/types";
import { useInventoryFilters, type SortKey } from "../store/ui";

const VIRTUALIZE_AFTER = 60;

function useColumns() {
  const get = () => {
    const w = typeof window === "undefined" ? 390 : window.innerWidth;
    return w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 768 ? 4 : w >= 600 ? 3 : 2;
  };
  const [cols, setCols] = useState(get);
  useEffect(() => {
    const on = () => setCols(get());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return cols;
}

export function filterAndSort(items: InventoryItem[], f: { search: string; rarity: string; weapon: string; collection: string; sort: SortKey }) {
  const q = f.search.trim().toLowerCase();
  const out = items.filter(
    (i) =>
      (f.rarity === "all" || i.skin.rarity === f.rarity) &&
      (f.weapon === "all" || i.skin.weaponType === f.weapon) &&
      (f.collection === "all" || i.skin.collection === f.collection) &&
      (!q || i.skin.name.toLowerCase().includes(q) || i.skin.weaponName.toLowerCase().includes(q) || i.skin.collection.toLowerCase().includes(q)),
  );
  out.sort((a, b) => {
    if (f.sort === "rarity") return RARITY_RANK[b.skin.rarity] - RARITY_RANK[a.skin.rarity] || b.skin.virtualPrice - a.skin.virtualPrice;
    if (f.sort === "value") return b.skin.virtualPrice - a.skin.virtualPrice;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return out;
}

const Grid = memo(function Grid({ items, cols, onOpen }: { items: InventoryItem[]; cols: number; onOpen: (id: number) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtual = items.length > VIRTUALIZE_AFTER;
  const rows = Math.ceil(items.length / cols);
  const virtualizer = useWindowVirtualizer({
    count: virtual ? rows : 0,
    estimateSize: () => 230,
    overscan: 4,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  if (!virtual) {
    return (
      <motion.div layout className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((i) => (
            <motion.div key={i.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}>
              <SkinCard skin={i.skin} quantity={i.quantity} favorite={i.favorite} onClick={() => onOpen(i.skin.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          className="absolute inset-x-0 grid gap-3 pb-3"
          style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {items.slice(row.index * cols, row.index * cols + cols).map((i) => (
            <SkinCard key={i.id} skin={i.skin} quantity={i.quantity} favorite={i.favorite} onClick={() => onOpen(i.skin.id)} />
          ))}
        </div>
      ))}
    </div>
  );
});

export default function Inventory() {
  const t = useT();
  const navigate = useNavigate();
  const inv = useInventory();
  const f = useInventoryFilters();
  const search = useDeferredValue(f.search);
  const cols = useColumns();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const collections = useMemo(() => [...new Set((inv.data ?? []).map((i) => i.skin.collection))].sort(), [inv.data]);
  const items = useMemo(
    () => filterAndSort(inv.data ?? [], { search, rarity: f.rarity, weapon: f.weapon, collection: f.collection, sort: f.sort }),
    [inv.data, search, f.rarity, f.weapon, f.collection, f.sort],
  );
  const activeFilters = (f.weapon !== "all" ? 1 : 0) + (f.collection !== "all" ? 1 : 0);
  const total = (inv.data ?? []).reduce((s, i) => s + i.quantity, 0);

  return (
    <>
      <TopBar title={t("inv.title")} subtitle={inv.data ? t("inv.items", { count: total }) : undefined} />
      <Page wide>
        <div className="sticky top-[calc(56px+env(safe-area-inset-top))] z-20 -mx-4 bg-bg/90 px-4 pb-3 pt-1 backdrop-blur-md">
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">{t("inv.search")}</span>
              <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={f.search}
                onChange={(e) => f.set({ search: e.target.value })}
                placeholder={t("inv.search")}
                className="input pl-10"
                enterKeyHint="search"
                maxLength={60}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                haptic.select();
                setFiltersOpen(true);
              }}
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border hairline bg-surface2 text-muted hover:text-fg"
              aria-label="Filters and sorting"
            >
              <Icon name="filter" size={19} />
              {activeFilters > 0 && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-[#0b0c0f]">{activeFilters}</span>}
            </button>
          </div>
          <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t("inv.rarity")}>
            {(["all", ...RARITIES] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={f.rarity === r}
                onClick={() => {
                  haptic.select();
                  f.set({ rarity: r });
                }}
                className="chip shrink-0"
              >
                {r !== "all" && <span className="h-2 w-2 rounded-full" style={{ background: RARITY_HEX[r] }} />}
                {r === "all" ? t("inv.all") : t(`rarity.${r}`)}
              </button>
            ))}
          </div>
        </div>

        {inv.isLoading ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols * 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
            ))}
          </div>
        ) : inv.isError ? (
          <ErrorState error={inv.error} title={t("err.inventory.title")} onRetry={() => void inv.refetch()} />
        ) : (inv.data ?? []).length === 0 ? (
          <EmptyState icon="inventory" title={t("inv.empty")} body={t("inv.emptyHint")} action={<Button onClick={() => navigate("/cases")}>{t("home.hero.cta")}</Button>} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="search"
            title={t("inv.noMatch")}
            action={
              <Button variant="secondary" onClick={f.reset}>
                {t("inv.clear")}
              </Button>
            }
          />
        ) : (
          <Grid items={items} cols={cols} onOpen={(id) => navigate(`/inventory/${id}`)} />
        )}
      </Page>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t("inv.filters")}>
        <div className="space-y-5">
          <div>
            <p className="label mb-2">{t("inv.sort")}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["newest", "rarity", "value"] as SortKey[]).map((s) => (
                <button key={s} type="button" aria-pressed={f.sort === s} onClick={() => f.set({ sort: s })} className="chip justify-center">
                  <Icon name="sort" size={14} />
                  {t(`inv.sort.${s}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-2">{t("inv.weapon")}</p>
            <div className="flex flex-wrap gap-2">
              {(["all", ...WEAPONS] as const).map((w) => (
                <button key={w} type="button" aria-pressed={f.weapon === w} onClick={() => f.set({ weapon: w })} className="chip">
                  {w === "all" ? t("inv.all") : t(`weapon.${w}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-2">{t("inv.collection")}</p>
            <div className="flex flex-wrap gap-2">
              {["all", ...collections].map((c) => (
                <button key={c} type="button" aria-pressed={f.collection === c} onClick={() => f.set({ collection: c })} className={clsx("chip")}>
                  {c === "all" ? t("inv.all") : c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button variant="secondary" onClick={() => f.set({ weapon: "all", collection: "all", sort: "newest" })}>
              {t("inv.clear")}
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>{t("open.done")}</Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

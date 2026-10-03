import clsx from "clsx";
import type { ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { Skeleton } from "../../components/ui";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters?: ReactNode;
  page?: number;
  pageSize?: number;
  total?: number;
  onPage?: (p: number) => void;
  empty?: string;
}

export function DataTable<T>({ columns, rows, loading, error, onRetry, rowKey, onRowClick, search, filters, page = 1, pageSize = 20, total, onPage, empty = "Hozircha hech narsa yo'q." }: Props<T>) {
  const pages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return (
    <div className="card overflow-hidden">
      {(search || filters) && (
        <div className="flex flex-wrap items-center gap-2 border-b hairline p-3">
          {search && (
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Qidirish</span>
              <Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input pl-9" value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder ?? "Qidirish…"} type="search" maxLength={100} />
            </label>
          )}
          {filters}
        </div>
      )}
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={clsx("sticky top-0 z-10 border-b hairline bg-surface px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted", c.className, c.hideOnMobile && "hidden md:table-cell")}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className={clsx("border-b hairline px-4 py-3.5", c.hideOnMobile && "hidden md:table-cell")}>
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <p className="text-sm text-danger">{error}</p>
                  {onRetry && (
                    <button type="button" className="btn btn-secondary mt-3 text-sm" onClick={onRetry}>
                      <Icon name="refresh" size={16} /> Qayta urinish
                    </button>
                  )}
                </td>
              </tr>
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center text-sm text-muted">
                  <Icon name="list" size={24} className="mx-auto mb-2 opacity-60" />
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={clsx("transition-colors hover:bg-white/[0.025]", onRowClick && "cursor-pointer")}>
                  {columns.map((c) => (
                    <td key={c.key} className={clsx("border-b hairline px-4 py-3 align-middle", c.className, c.hideOnMobile && "hidden md:table-cell")}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {onPage && total !== undefined && total > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t hairline px-4 py-2.5 text-xs text-muted">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} / {total}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/5 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Oldingi sahifa">
              <Icon name="back" size={16} />
            </button>
            <span className="px-2 tabular-nums">
              {page} / {pages}
            </span>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/5 disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Keyingi sahifa">
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

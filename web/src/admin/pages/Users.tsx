import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Sheet } from "../../components/Sheet";
import { Avatar, CoinIcon } from "../../components/ui";
import { fmt, shortDate } from "../../lib/format";
import { useDebounced } from "../../lib/hooks";
import { adminApi, type Paged } from "../api";
import { DataTable, type Column } from "../components/DataTable";
import { PageHeader, StatusPill } from "../components/kit";
import { UserDetail } from "../components/UserDetail";

export interface UserRow {
  id: number;
  telegram_id: number | null;
  username: string | null;
  first_name: string;
  avatar_url: string | null;
  virtual_coins: number;
  level: number;
  is_guest: boolean;
  blocked: boolean;
  openings: number;
  last_seen_date: string | null;
  created_at: string;
}

export const userColumns: Column<UserRow>[] = [
  { key: "user", header: "Foydalanuvchi", render: (u) => <div className="flex items-center gap-3"><Avatar src={u.avatar_url} name={u.first_name} size={32} /><div className="min-w-0"><p className="truncate font-medium">{u.first_name}</p><p className="truncate text-xs text-muted">{u.username ? `@${u.username}` : u.is_guest ? "mehmon" : `tg ${u.telegram_id}`}</p></div></div> },
  { key: "coins", header: "Virtual tangalar", render: (u) => <span className="inline-flex items-center gap-1 tabular-nums"><CoinIcon size={12} />{fmt(u.virtual_coins)}</span> },
  { key: "level", header: "Daraja", render: (u) => u.level },
  { key: "openings", header: "Ochilishlar", render: (u) => fmt(u.openings), hideOnMobile: true },
  { key: "seen", header: "Oxirgi kirish", render: (u) => <span className="text-xs text-muted">{u.last_seen_date ? shortDate(u.last_seen_date) : "—"}</span>, hideOnMobile: true },
  { key: "status", header: "Holat", render: (u) => <StatusPill active={!u.blocked} on="Faol" off="Bloklangan" /> },
];

export function useUserList(search: string, page: number) {
  const q = useDebounced(search, 250);
  return useQuery({
    queryKey: ["admin", "users", q, page],
    queryFn: () => adminApi.get<Paged<UserRow>>(`/users?page=${page}&pageSize=20&q=${encodeURIComponent(q)}`),
    placeholderData: (p) => p,
  });
}

export default function Users() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => setPage(1), [search]);
  const q = useUserList(search, page);
  return (
    <>
      <PageHeader title="Foydalanuvchilar" subtitle="O'yinchilar, balanslar (faqat virtual) va faollik." />
      <DataTable
        columns={userColumns}
        rows={q.data?.rows}
        loading={q.isLoading}
        error={q.isError ? "Foydalanuvchilarni yuklab bo'lmadi." : null}
        onRetry={() => void q.refetch()}
        rowKey={(u) => u.id}
        onRowClick={(u) => setOpen(u.id)}
        search={{ value: search, onChange: setSearch, placeholder: "Ism, @username, Telegram ID yoki foydalanuvchi ID bo'yicha qidirish…" }}
        page={page}
        total={q.data?.total}
        onPage={setPage}
        empty="Foydalanuvchi topilmadi."
      />
      <Sheet open={open !== null} onClose={() => setOpen(null)} title="Foydalanuvchi" variant="dialog" maxWidth="40rem">
        {open !== null && <UserDetail userId={open} canEdit />}
      </Sheet>
    </>
  );
}

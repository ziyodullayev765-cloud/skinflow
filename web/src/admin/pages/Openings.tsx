import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CoinIcon } from "../../components/ui";
import { fmt } from "../../lib/format";
import { useDebounced } from "../../lib/hooks";
import type { Rarity } from "../../lib/types";
import { adminApi, type Paged } from "../api";
import { DataTable } from "../components/DataTable";
import { PageHeader, RarityPill } from "../components/kit";

interface Row {
  id: number;
  created_at: string;
  cost: number;
  user_id: number;
  username: string | null;
  first_name: string;
  case_name: string;
  skin_name: string;
  weapon_name: string;
  rarity: Rarity;
  image: string;
}

export default function Openings() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search, 250);
  useEffect(() => setPage(1), [q]);
  const data = useQuery({
    queryKey: ["admin", "openings", q, page],
    queryFn: () => adminApi.get<Paged<Row>>(`/openings?page=${page}&pageSize=25&q=${encodeURIComponent(q)}`),
    placeholderData: (p) => p,
    refetchInterval: 20_000,
  });
  return (
    <>
      <PageHeader title="Ochilishlar" subtitle="Barcha keys ochilishlari, server tomonidan aniqlangan." />
      <DataTable
        columns={[
          { key: "id", header: "#", render: (r) => <span className="text-muted tabular-nums">{r.id}</span> },
          { key: "user", header: "Foydalanuvchi", render: (r) => <span>{r.first_name}{r.username && <span className="text-muted"> @{r.username}</span>}</span> },
          { key: "case", header: "Keys", render: (r) => r.case_name },
          { key: "skin", header: "Natija", render: (r) => <div className="flex items-center gap-2"><img src={r.image} alt="" className="h-7 w-10 object-contain" loading="lazy" /><span>{r.skin_name}<span className="text-muted"> · {r.weapon_name}</span></span></div> },
          { key: "rarity", header: "Noyoblik", render: (r) => <RarityPill rarity={r.rarity} /> },
          { key: "cost", header: "Narx", render: (r) => <span className="inline-flex items-center gap-1 tabular-nums"><CoinIcon size={12} />{fmt(r.cost)}</span>, hideOnMobile: true },
          { key: "at", header: "Vaqt", render: (r) => <span className="whitespace-nowrap text-xs text-muted">{new Date(r.created_at).toLocaleString()}</span>, hideOnMobile: true },
        ]}
        rows={data.data?.rows}
        loading={data.isLoading}
        error={data.isError ? "Ochilishlarni yuklab bo'lmadi." : null}
        onRetry={() => void data.refetch()}
        rowKey={(r) => r.id}
        search={{ value: search, onChange: setSearch, placeholder: "Foydalanuvchi yoki skin qidirish…" }}
        page={page}
        pageSize={25}
        total={data.data?.total}
        onPage={setPage}
        empty="Hali ochilishlar yo'q."
      />
    </>
  );
}

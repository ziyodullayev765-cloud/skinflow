import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CoinIcon } from "../../components/ui";
import { fmt, shortDate } from "../../lib/format";
import { adminApi } from "../api";
import { DataTable } from "../components/DataTable";
import { PageHeader, StatCard } from "../components/kit";

interface Resp {
  rows: { id: number; claim_date: string; amount: number; created_at: string; user_id: number; username: string | null; first_name: string }[];
  total: number;
  summary: { claims_today: number; claims_total: number; coins_total: number; dailyRewardAmount: number };
}

export default function Rewards() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["admin", "rewards", page], queryFn: () => adminApi.get<Resp>(`/rewards?page=${page}&pageSize=20`), placeholderData: (p) => p });
  const s = q.data?.summary;
  return (
    <>
      <PageHeader title="Kunlik mukofotlar" subtitle="Belgilangan bepul virtual tanga mukofoti — pullik ko'paytirgichlar va tasodifiy pul mukofotlari yo'q. Miqdorni Sozlamalarda o'zgartiring." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard loading={q.isLoading} label="Joriy kunlik miqdor" value={<span className="inline-flex items-center gap-1.5"><CoinIcon size={18} />{fmt(s?.dailyRewardAmount ?? 0)}</span>} icon="gift" tone="coin" />
        <StatCard loading={q.isLoading} label="Bugun olinganlar" value={fmt(s?.claims_today ?? 0)} icon="check" tone="success" />
        <StatCard loading={q.isLoading} label="Jami olinganlar" value={fmt(s?.claims_total ?? 0)} icon="history" />
        <StatCard loading={q.isLoading} label="Berilgan tangalar" value={fmt(s?.coins_total ?? 0)} icon="coin" tone="accent2" />
      </div>
      <DataTable
        columns={[
          { key: "user", header: "Foydalanuvchi", render: (r) => <span>{r.first_name}{r.username && <span className="text-muted"> @{r.username}</span>}</span> },
          { key: "date", header: "Kun (UTC)", render: (r) => shortDate(r.claim_date) },
          { key: "amount", header: "Miqdor", render: (r) => <span className="inline-flex items-center gap-1"><CoinIcon size={12} />{fmt(r.amount)}</span> },
          { key: "at", header: "Olingan vaqt", render: (r) => <span className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</span>, hideOnMobile: true },
        ]}
        rows={q.data?.rows}
        loading={q.isLoading}
        error={q.isError ? "Mukofotlarni yuklab bo'lmadi." : null}
        onRetry={() => void q.refetch()}
        rowKey={(r) => r.id}
        page={page}
        total={q.data?.total}
        onPage={setPage}
        empty="Hali kunlik mukofot olinmagan."
      />
    </>
  );
}

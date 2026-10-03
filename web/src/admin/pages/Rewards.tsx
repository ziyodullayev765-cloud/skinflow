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
      <PageHeader title="Daily rewards" subtitle="Fixed free virtual coin reward — no paid multipliers, no random monetary rewards. Change the amount in Settings." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard loading={q.isLoading} label="Current daily amount" value={<span className="inline-flex items-center gap-1.5"><CoinIcon size={18} />{fmt(s?.dailyRewardAmount ?? 0)}</span>} icon="gift" tone="coin" />
        <StatCard loading={q.isLoading} label="Claims today" value={fmt(s?.claims_today ?? 0)} icon="check" tone="success" />
        <StatCard loading={q.isLoading} label="All-time claims" value={fmt(s?.claims_total ?? 0)} icon="history" />
        <StatCard loading={q.isLoading} label="Coins granted" value={fmt(s?.coins_total ?? 0)} icon="coin" tone="accent2" />
      </div>
      <DataTable
        columns={[
          { key: "user", header: "User", render: (r) => <span>{r.first_name}{r.username && <span className="text-muted"> @{r.username}</span>}</span> },
          { key: "date", header: "Day (UTC)", render: (r) => shortDate(r.claim_date) },
          { key: "amount", header: "Amount", render: (r) => <span className="inline-flex items-center gap-1"><CoinIcon size={12} />{fmt(r.amount)}</span> },
          { key: "at", header: "Claimed at", render: (r) => <span className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</span>, hideOnMobile: true },
        ]}
        rows={q.data?.rows}
        loading={q.isLoading}
        error={q.isError ? "Couldn't load rewards." : null}
        onRetry={() => void q.refetch()}
        rowKey={(r) => r.id}
        page={page}
        total={q.data?.total}
        onPage={setPage}
        empty="No daily rewards claimed yet."
      />
    </>
  );
}

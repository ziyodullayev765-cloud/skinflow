import { useQuery } from "@tanstack/react-query";
import { fmt } from "../../lib/format";
import { RARITY_HEX } from "../../lib/rarity";
import type { Rarity } from "../../lib/types";
import { adminApi } from "../api";
import { BarList, Donut, LineChart } from "../components/Charts";
import { Notice, PageHeader, StatCard } from "../components/kit";
import { Skeleton } from "../../components/ui";

interface DashboardData {
  totals: {
    total_users: number;
    active_users: number;
    daily_active_users: number;
    new_users_today: number;
    total_coins: number;
    total_openings: number;
    openings_today: number;
    skins_collected: number;
  };
  usersPerDay: { day: string; value: number }[];
  openingsPerDay: { day: string; value: number }[];
  topCases: { label: string; value: number }[];
  topSkins: { label: string; value: number; rarity: Rarity }[];
  rarity: { label: Rarity; value: number }[];
}

function ChartCard({ title, children, loading }: { title: string; children: React.ReactNode; loading?: boolean }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {loading ? <Skeleton className="h-40 w-full" /> : children}
    </section>
  );
}

export default function Dashboard() {
  const q = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => adminApi.get<DashboardData>("/dashboard"), refetchInterval: 30_000 });
  const t = q.data?.totals;
  const loading = q.isLoading;
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live overview of the virtual collection game." />
      {q.isError && (
        <div className="mb-4">
          <Notice tone="error">Couldn't load statistics. <button className="underline" onClick={() => void q.refetch()}>Retry</button></Notice>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard loading={loading} label="Total users" value={fmt(t?.total_users ?? 0)} icon="users" />
        <StatCard loading={loading} label="Active users (7d)" value={fmt(t?.active_users ?? 0)} icon="bolt" tone="accent2" />
        <StatCard loading={loading} label="Daily active" value={fmt(t?.daily_active_users ?? 0)} icon="flame" tone="success" />
        <StatCard loading={loading} label="New users today" value={fmt(t?.new_users_today ?? 0)} icon="plus" />
        <StatCard loading={loading} label="Virtual coins in circulation" value={fmt(t?.total_coins ?? 0)} icon="coin" tone="coin" />
        <StatCard loading={loading} label="Total case openings" value={fmt(t?.total_openings ?? 0)} icon="cases" tone="accent2" />
        <StatCard loading={loading} label="Openings today" value={fmt(t?.openings_today ?? 0)} icon="history" tone="success" />
        <StatCard loading={loading} label="Skins collected" value={fmt(t?.skins_collected ?? 0)} icon="skins" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Users per day" loading={loading}>
          <LineChart data={q.data?.usersPerDay ?? []} />
        </ChartCard>
        <ChartCard title="Openings per day" loading={loading}>
          <LineChart data={q.data?.openingsPerDay ?? []} color="rgb(var(--accent-2))" />
        </ChartCard>
        <ChartCard title="Most opened cases" loading={loading}>
          <BarList data={q.data?.topCases ?? []} />
        </ChartCard>
        <ChartCard title="Most collected skins" loading={loading}>
          <BarList data={q.data?.topSkins ?? []} colorFor={(d) => RARITY_HEX[(d.rarity as Rarity) ?? "common"]} />
        </ChartCard>
        <ChartCard title="Rarity distribution (all drops)" loading={loading}>
          <Donut data={(["common", "uncommon", "rare", "epic", "legendary"] as Rarity[]).map((r) => ({ label: r, value: q.data?.rarity.find((x) => x.label === r)?.value ?? 0, color: RARITY_HEX[r] }))} />
        </ChartCard>
      </div>
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useDebounced } from "../../lib/hooks";
import { adminApi, type Paged } from "../api";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/kit";

interface Log {
  id: number;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  created_at: string;
  username: string | null;
}

export default function Logs() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search, 250);
  useEffect(() => setPage(1), [q]);
  const data = useQuery({ queryKey: ["admin", "logs", q, page], queryFn: () => adminApi.get<Paged<Log>>(`/logs?page=${page}&pageSize=30&q=${encodeURIComponent(q)}`), placeholderData: (p) => p });
  return (
    <>
      <PageHeader title="Audit logs" subtitle="Every admin action is recorded." />
      <DataTable
        columns={[
          { key: "at", header: "Time", render: (l) => <span className="whitespace-nowrap text-xs text-muted">{new Date(l.created_at).toLocaleString()}</span> },
          { key: "admin", header: "Admin", render: (l) => l.username ?? <span className="text-muted">—</span> },
          { key: "action", header: "Action", render: (l) => <code className={`rounded bg-surface2 px-1.5 py-0.5 text-xs ${l.action.includes("failed") ? "text-danger" : ""}`}>{l.action}</code> },
          { key: "entity", header: "Entity", render: (l) => <span className="text-muted">{l.entity ? `${l.entity}${l.entity_id ? ` #${l.entity_id}` : ""}` : "—"}</span>, hideOnMobile: true },
          { key: "details", header: "Details", render: (l) => <span className="line-clamp-1 max-w-[320px] font-mono text-[11px] text-muted">{JSON.stringify(l.details)}</span>, hideOnMobile: true },
          { key: "ip", header: "IP", render: (l) => <span className="text-xs text-muted">{l.ip}</span>, hideOnMobile: true },
        ]}
        rows={data.data?.rows}
        loading={data.isLoading}
        error={data.isError ? "Couldn't load logs." : null}
        onRetry={() => void data.refetch()}
        rowKey={(l) => l.id}
        search={{ value: search, onChange: setSearch, placeholder: "Filter by action, entity or admin…" }}
        page={page}
        pageSize={30}
        total={data.data?.total}
        onPage={setPage}
      />
    </>
  );
}

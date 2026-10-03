import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { CoinIcon, Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api";
import type { AdminMe } from "../AdminApp";
import { adminApi } from "../api";
import { DataTable } from "../components/DataTable";
import { Field, IconButton, Input, Notice, PageHeader, Segmented, Select, StatusPill } from "../components/kit";

interface Mission {
  id: number;
  code: string;
  title: string;
  description: string;
  type: string;
  target: number;
  reward: number;
  period: "daily" | "weekly" | "once";
  sortOrder: number;
  active: boolean;
  completions: number;
}

const TYPES = [
  { value: "open_case", label: "Open cases" },
  { value: "view_skins", label: "Inspect skins" },
  { value: "claim_daily", label: "Claim daily reward" },
  { value: "complete_profile", label: "Complete profile (favorite skin)" },
  { value: "login_streak", label: "Login streak (days)" },
];

const EMPTY = { code: "", title: "", description: "", type: "open_case", target: "1", reward: "100", period: "daily" as Mission["period"], sortOrder: "0", active: true };

function MissionForm({ mission, onSaved }: { mission: Mission | null; onSaved: () => void }) {
  const [f, setF] = useState(() =>
    mission ? { ...mission, target: String(mission.target), reward: String(mission.reward), sortOrder: String(mission.sortOrder) } : EMPTY,
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const body = { code: f.code.trim(), title: f.title.trim(), description: f.description.trim(), type: f.type, target: Number(f.target), reward: Number(f.reward), period: f.period, sortOrder: Number(f.sortOrder) || 0, active: f.active };
    try {
      if (mission) await adminApi.put(`/missions/${mission.id}`, body);
      else await adminApi.post("/missions", body);
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? `${e2.message}${Array.isArray(e2.details) ? ": " + (e2.details as { path: string; message: string }[]).map((d) => `${d.path} — ${d.message}`).join("; ") : ""}` : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4 pt-1">
      {err && <Notice tone="error">{err}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={80} /></Field>
        <Field label="Code" hint="lowercase-with-dashes"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required pattern="[a-z0-9-]{3,40}" /></Field>
        <Field label="Description" className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
        <Field label="Target"><Input type="number" min={1} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
        <Field label="Reward (virtual coins only)"><Input type="number" min={0} value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} /></Field>
        <Field label="Sort order"><Input type="number" min={0} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap gap-6">
        <div><p className="mb-1.5 text-xs font-medium text-muted">Duration</p><Segmented value={f.period} onChange={(v) => setF({ ...f, period: v })} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "once", label: "One-time" }]} /></div>
        <div><p className="mb-1.5 text-xs font-medium text-muted">Status</p><Segmented value={f.active ? "on" : "off"} onChange={(v) => setF({ ...f, active: v === "on" })} options={[{ value: "on", label: "Active" }, { value: "off", label: "Inactive" }]} /></div>
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : mission ? "Save mission" : "Create mission"}</button>
    </form>
  );
}

export default function Missions({ me }: { me: AdminMe }) {
  const qc = useQueryClient();
  const canEdit = me.role !== "viewer";
  const [editing, setEditing] = useState<Mission | null | "new">(null);
  const q = useQuery({ queryKey: ["admin", "missions"], queryFn: () => adminApi.get<{ rows: Mission[] }>("/missions").then((r) => r.rows) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "missions"] });
  return (
    <>
      <PageHeader
        title="Missions"
        subtitle="Non-monetary daily / weekly missions. Rewards are virtual coins only."
        actions={canEdit && <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={18} /> New mission</button>}
      />
      <DataTable
        columns={[
          { key: "title", header: "Mission", render: (m) => <div><p className="font-medium">{m.title}</p><p className="text-xs text-muted">{m.code}</p></div> },
          { key: "type", header: "Type", render: (m) => <span className="text-muted">{TYPES.find((t) => t.value === m.type)?.label}</span>, hideOnMobile: true },
          { key: "target", header: "Target", render: (m) => m.target },
          { key: "reward", header: "Reward", render: (m) => <span className="inline-flex items-center gap-1"><CoinIcon size={12} />{m.reward}</span> },
          { key: "period", header: "Duration", render: (m) => <span className="capitalize">{m.period}</span> },
          { key: "done", header: "Claims", render: (m) => m.completions, hideOnMobile: true },
          { key: "status", header: "Status", render: (m) => <StatusPill active={m.active} /> },
          {
            key: "act", header: "", className: "text-right", render: (m) => canEdit ? (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <IconButton icon="edit" label="Edit" onClick={() => setEditing(m)} />
                <IconButton icon={m.active ? "eye" : "check"} label={m.active ? "Deactivate" : "Activate"} onClick={async () => { await adminApi.put(`/missions/${m.id}`, { code: m.code, title: m.title, description: m.description, type: m.type, target: m.target, reward: m.reward, period: m.period, sortOrder: m.sortOrder, active: !m.active }); refresh(); }} />
              </div>
            ) : null,
          },
        ]}
        rows={q.data}
        loading={q.isLoading}
        error={q.isError ? "Couldn't load missions." : null}
        onRetry={() => void q.refetch()}
        rowKey={(m) => m.id}
        onRowClick={canEdit ? (m) => setEditing(m) : undefined}
      />
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New mission" : "Edit mission"} variant="dialog" maxWidth="36rem">
        {editing !== null && <MissionForm key={editing === "new" ? "new" : editing.id} mission={editing === "new" ? null : editing} onSaved={() => { refresh(); setEditing(null); }} />}
      </Sheet>
    </>
  );
}

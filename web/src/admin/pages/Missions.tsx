import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { CoinIcon, Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api";
import type { AdminMe } from "../AdminApp";
import { adminApi } from "../api";
import { DataTable } from "../components/DataTable";
import { Field, IconButton, Input, Notice, PageHeader, PERIOD_UZ, Segmented, Select, StatusPill } from "../components/kit";

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
  { value: "open_case", label: "Keys ochish" },
  { value: "view_skins", label: "Skinlarni ko'rish" },
  { value: "claim_daily", label: "Kunlik mukofotni olish" },
  { value: "complete_profile", label: "Profilni to'ldirish (sevimli skin)" },
  { value: "login_streak", label: "Kirish seriyasi (kun)" },
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
      setErr(e2 instanceof ApiError ? `${e2.message}${Array.isArray(e2.details) ? ": " + (e2.details as { path: string; message: string }[]).map((d) => `${d.path} — ${d.message}`).join("; ") : ""}` : "Saqlashda xatolik");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4 pt-1">
      {err && <Notice tone="error">{err}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sarlavha"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={80} /></Field>
        <Field label="Kod" hint="kichik-harflar-va-chiziqcha"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required pattern="[a-z0-9-]{3,40}" /></Field>
        <Field label="Tavsif" className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} /></Field>
        <Field label="Turi"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
        <Field label="Maqsad"><Input type="number" min={1} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
        <Field label="Mukofot (faqat virtual tanga)"><Input type="number" min={0} value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} /></Field>
        <Field label="Tartib raqami"><Input type="number" min={0} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap gap-6">
        <div><p className="mb-1.5 text-xs font-medium text-muted">Muddat</p><Segmented value={f.period} onChange={(v) => setF({ ...f, period: v })} options={[{ value: "daily", label: "Kunlik" }, { value: "weekly", label: "Haftalik" }, { value: "once", label: "Bir martalik" }]} /></div>
        <div><p className="mb-1.5 text-xs font-medium text-muted">Holat</p><Segmented value={f.active ? "on" : "off"} onChange={(v) => setF({ ...f, active: v === "on" })} options={[{ value: "on", label: "Faol" }, { value: "off", label: "Nofaol" }]} /></div>
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : mission ? "Vazifani saqlash" : "Vazifa yaratish"}</button>
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
        title="Vazifalar"
        subtitle="Pulsiz kunlik / haftalik vazifalar. Mukofot faqat virtual tanga."
        actions={canEdit && <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={18} /> Yangi vazifa</button>}
      />
      <DataTable
        columns={[
          { key: "title", header: "Vazifa", render: (m) => <div><p className="font-medium">{m.title}</p><p className="text-xs text-muted">{m.code}</p></div> },
          { key: "type", header: "Turi", render: (m) => <span className="text-muted">{TYPES.find((t) => t.value === m.type)?.label}</span>, hideOnMobile: true },
          { key: "target", header: "Maqsad", render: (m) => m.target },
          { key: "reward", header: "Mukofot", render: (m) => <span className="inline-flex items-center gap-1"><CoinIcon size={12} />{m.reward}</span> },
          { key: "period", header: "Muddat", render: (m) => <span>{PERIOD_UZ[m.period] ?? m.period}</span> },
          { key: "done", header: "Olinganlar", render: (m) => m.completions, hideOnMobile: true },
          { key: "status", header: "Holat", render: (m) => <StatusPill active={m.active} /> },
          {
            key: "act", header: "", className: "text-right", render: (m) => canEdit ? (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <IconButton icon="edit" label="Tahrirlash" onClick={() => setEditing(m)} />
                <IconButton icon={m.active ? "eye" : "check"} label={m.active ? "O'chirish" : "Faollashtirish"} onClick={async () => { await adminApi.put(`/missions/${m.id}`, { code: m.code, title: m.title, description: m.description, type: m.type, target: m.target, reward: m.reward, period: m.period, sortOrder: m.sortOrder, active: !m.active }); refresh(); }} />
              </div>
            ) : null,
          },
        ]}
        rows={q.data}
        loading={q.isLoading}
        error={q.isError ? "Vazifalarni yuklab bo'lmadi." : null}
        onRetry={() => void q.refetch()}
        rowKey={(m) => m.id}
        onRowClick={canEdit ? (m) => setEditing(m) : undefined}
      />
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Yangi vazifa" : "Vazifani tahrirlash"} variant="dialog" maxWidth="36rem">
        {editing !== null && <MissionForm key={editing === "new" ? "new" : editing.id} mission={editing === "new" ? null : editing} onSaved={() => { refresh(); setEditing(null); }} />}
      </Sheet>
    </>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { CoinIcon, Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { fmt, shortDate } from "../../lib/format";
import type { AdminMe } from "../AdminApp";
import { adminApi } from "../api";
import { DataTable } from "../components/DataTable";
import { Field, IconButton, Input, Notice, PageHeader, Segmented, StatusPill } from "../components/kit";

interface Promo {
  id: number;
  code: string;
  reward: number;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  active: boolean;
  note: string;
  createdAt: string;
}

const randomCode = () => "SF" + Math.random().toString(36).slice(2, 8).toUpperCase();

function PromoForm({ promo, onSaved }: { promo: Promo | null; onSaved: () => void }) {
  const [f, setF] = useState({
    code: promo?.code ?? randomCode(),
    reward: String(promo?.reward ?? 500),
    maxUses: promo?.maxUses ? String(promo.maxUses) : "",
    expiresAt: promo?.expiresAt ? promo.expiresAt.slice(0, 16) : "",
    active: promo?.active ?? true,
    note: promo?.note ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const reward = Number(f.reward);
    if (!Number.isInteger(reward) || reward <= 0) return setErr("Mukofot musbat butun son bo'lishi kerak");
    setBusy(true);
    const body = {
      code: f.code.trim().toUpperCase(),
      reward,
      maxUses: f.maxUses ? Number(f.maxUses) : null,
      expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
      active: f.active,
      note: f.note.trim(),
    };
    try {
      if (promo) await adminApi.put(`/promo-codes/${promo.id}`, body);
      else await adminApi.post("/promo-codes", body);
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
        <Field label="Kod">
          <div className="flex gap-2">
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} maxLength={32} required className="uppercase tracking-wider" />
            <button type="button" className="btn btn-secondary shrink-0 px-3" onClick={() => setF({ ...f, code: randomCode() })} aria-label="Kod yaratish"><Icon name="refresh" size={16} /></button>
          </div>
        </Field>
        <Field label="Mukofot (virtual tanga)">
          <Input type="number" min={1} value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} />
        </Field>
        <Field label="Maksimal foydalanish" hint="Bo'sh = cheksiz (har bir o'yinchi bir marta)">
          <Input type="number" min={1} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} />
        </Field>
        <Field label="Tugash vaqti" hint="Bo'sh = muddatsiz">
          <Input type="datetime-local" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
        </Field>
        <Field label="Izoh (ichki)" className="sm:col-span-2">
          <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={200} placeholder="masalan: Telegram kanaldagi konkurs" />
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Holat</p>
        <Segmented value={f.active ? "on" : "off"} onChange={(v) => setF({ ...f, active: v === "on" })} options={[{ value: "on", label: "Faol" }, { value: "off", label: "O'chirilgan" }]} />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : promo ? "Promokodni saqlash" : "Promokod yaratish"}</button>
    </form>
  );
}

export default function PromoCodes({ me }: { me: AdminMe }) {
  const qc = useQueryClient();
  const canEdit = me.role !== "viewer";
  const [editing, setEditing] = useState<Promo | null | "new">(null);
  const q = useQuery({ queryKey: ["admin", "promo"], queryFn: () => adminApi.get<{ rows: Promo[] }>("/promo-codes").then((r) => r.rows) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "promo"] });
  return (
    <>
      <PageHeader
        title="Promokodlar"
        subtitle="Bepul virtual tanga beradigan kodlar. Har bir o'yinchi kodni bir marta ishlata oladi."
        actions={canEdit && <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={18} /> Yangi promokod</button>}
      />
      <DataTable
        columns={[
          { key: "code", header: "Kod", render: (p) => <code className="rounded bg-surface2 px-2 py-1 font-semibold tracking-wider">{p.code}</code> },
          { key: "reward", header: "Mukofot", render: (p) => <span className="inline-flex items-center gap-1 tabular-nums"><CoinIcon size={12} />{fmt(p.reward)}</span> },
          { key: "uses", header: "Foydalanilgan", render: (p) => <span className="tabular-nums">{p.uses}{p.maxUses ? ` / ${p.maxUses}` : ""}</span> },
          { key: "exp", header: "Tugaydi", render: (p) => <span className="text-xs text-muted">{p.expiresAt ? shortDate(p.expiresAt) : "Muddatsiz"}</span>, hideOnMobile: true },
          { key: "note", header: "Izoh", render: (p) => <span className="text-xs text-muted">{p.note || "—"}</span>, hideOnMobile: true },
          { key: "status", header: "Holat", render: (p) => <StatusPill active={p.active && (!p.expiresAt || new Date(p.expiresAt) > new Date()) && (!p.maxUses || p.uses < p.maxUses)} on="Faol" off="Nofaol" /> },
          {
            key: "act", header: "", className: "text-right", render: (p) => canEdit ? (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <IconButton icon="copy" label="Kodni nusxalash" onClick={() => void navigator.clipboard?.writeText(p.code)} />
                <IconButton icon="edit" label="Tahrirlash" onClick={() => setEditing(p)} />
                <IconButton icon="trash" label="O'chirish" tone="danger" onClick={async () => { if (confirm(`${p.code} o'chirilsinmi?`)) { await adminApi.del(`/promo-codes/${p.id}`); refresh(); } }} />
              </div>
            ) : null,
          },
        ]}
        rows={q.data}
        loading={q.isLoading}
        error={q.isError ? "Promokodlarni yuklab bo'lmadi." : null}
        onRetry={() => void q.refetch()}
        rowKey={(p) => p.id}
        onRowClick={canEdit ? (p) => setEditing(p) : undefined}
        empty="Hali promokodlar yo'q."
      />
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Yangi promokod" : "Promokodni tahrirlash"} variant="dialog" maxWidth="34rem">
        {editing !== null && <PromoForm key={editing === "new" ? "new" : editing.id} promo={editing === "new" ? null : editing} onSaved={() => { refresh(); setEditing(null); }} />}
      </Sheet>
    </>
  );
}

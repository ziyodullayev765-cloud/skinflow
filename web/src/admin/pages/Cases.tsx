import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { CoinIcon, Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { fmt, pct } from "../../lib/format";
import { RARITY_HEX, RARITY_RANK } from "../../lib/rarity";
import type { AdminMe } from "../AdminApp";
import { adminApi, uploadImage, type AdminSkin, type Paged } from "../api";
import { DataTable, type Column } from "../components/DataTable";
import { Field, IconButton, Input, Notice, PageHeader, RarityPill, Segmented, StatusPill, SuccessCheck, Textarea } from "../components/kit";

interface CaseRow {
  id: number;
  name: string;
  description: string;
  image: string;
  accent: string;
  cost: number;
  featured: boolean;
  sortOrder: number;
  active: boolean;
  itemCount: number;
  openings: number;
}

interface CaseDetail extends Omit<CaseRow, "itemCount" | "openings"> {
  items: { skin: AdminSkin; weight: number; probability: number }[];
}

interface Item {
  skin: AdminSkin;
  weight: number;
}

const DEFAULT_WEIGHT: Record<string, number> = { common: 1000, uncommon: 500, rare: 250, epic: 80, legendary: 25 };

function CaseEditor({ id, canEdit, onSaved }: { id: number | null; canEdit: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", image: "/assets/cases/placeholder.svg", accent: "#8b9bff", cost: "500", featured: false, active: true, sortOrder: "0" });
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pickQuery, setPickQuery] = useState("");
  const [sim, setSim] = useState<{ skin: AdminSkin; expected: number; observed: number }[] | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const allSkins = useQuery({ queryKey: ["admin", "skins", "all"], queryFn: () => adminApi.get<Paged<AdminSkin>>("/skins?all=1").then((r) => r.rows) });

  useEffect(() => {
    setSaved(false);
    setError(null);
    setSim(null);
    if (!id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    adminApi
      .get<{ case: CaseDetail }>(`/cases/${id}`)
      .then(({ case: c }) => {
        setForm({ name: c.name, description: c.description, image: c.image, accent: c.accent, cost: String(c.cost), featured: c.featured, active: c.active, sortOrder: String(c.sortOrder) });
        setItems(c.items.map((i) => ({ skin: i.skin, weight: i.weight })));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Keysni yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [id]);

  const total = items.reduce((s, i) => s + (i.weight > 0 ? i.weight : 0), 0);
  const sorted = useMemo(() => [...items].sort((a, b) => RARITY_RANK[b.skin.rarity] - RARITY_RANK[a.skin.rarity] || b.skin.virtualPrice - a.skin.virtualPrice), [items]);
  const candidates = (allSkins.data ?? []).filter((s) => !items.some((i) => i.skin.id === s.id) && (!pickQuery || `${s.name} ${s.weaponName} ${s.collection}`.toLowerCase().includes(pickQuery.toLowerCase()))).slice(0, 12);
  const avgValue = total ? items.reduce((s, i) => s + (i.weight / total) * i.skin.virtualPrice, 0) : 0;

  const save = async () => {
    setError(null);
    const cost = Number(form.cost);
    if (form.name.trim().length < 2) return setError("Keys nomi majburiy");
    if (!Number.isInteger(cost) || cost < 0) return setError("Keys narxi 0 yoki undan katta butun son bo'lishi kerak");
    if (items.some((i) => !Number.isInteger(i.weight) || i.weight < 1)) return setError("Har bir og'irlik 1 yoki undan katta butun son bo'lishi kerak");
    setSaving(true);
    try {
      const body = { name: form.name.trim(), description: form.description.trim(), image: form.image, accent: form.accent, cost, featured: form.featured, active: form.active, sortOrder: Number(form.sortOrder) || 0 };
      const r = id ? await adminApi.put<{ case: CaseDetail }>(`/cases/${id}`, body) : await adminApi.post<{ case: CaseDetail }>("/cases", body);
      await adminApi.put(`/cases/${r.case.id}/items`, { items: items.map((i) => ({ skinId: i.skin.id, weight: i.weight })) });
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}${Array.isArray(e.details) ? ": " + (e.details as { path: string; message: string }[]).map((d) => `${d.path} ${d.message}`).join(", ") : ""}` : "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  const simulate = async () => {
    if (!id) return;
    setSimBusy(true);
    try {
      const r = await adminApi.post<{ results: { skin: AdminSkin; expected: number; observed: number }[] }>(`/cases/${id}/preview`, { count: 5000 });
      setSim(r.results);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Simulyatsiya bajarilmadi");
    } finally {
      setSimBusy(false);
    }
  };

  if (loading) return <div className="grid place-items-center py-16"><Spinner className="text-muted" /></div>;
  if (saved && !id) return <SuccessCheck label="Keys yaratildi" />;

  return (
    <div className="space-y-5 pt-1">
      {error && <Notice tone="error">{error}</Notice>}
      {saved && id && <Notice>Keys saqlandi. O'zgarishlar o'yinchilar uchun kuchga kirdi.</Notice>}

      {/* Case preview */}
      <section className="relative overflow-hidden rounded-2xl border hairline bg-bg p-4">
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 80% at 0% 50%, ${form.accent}30, transparent 70%)` }} />
        <div className="relative flex items-center gap-4">
          <img src={form.image} alt="" className="h-20 w-20 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold uppercase tracking-wide">{form.name || "Keys nomi"}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-muted">
              <span className="inline-flex items-center gap-1">Keys narxi: <CoinIcon size={13} /> <b className="text-fg">{fmt(Number(form.cost) || 0)}</b> virtual tanga</span>
              <span>Mavjud skinlar: <b className="text-fg">{items.length}</b></span>
              <span>O'rtacha virtual qiymat: <b className="text-fg">{fmt(avgValue)}</b></span>
            </p>
          </div>
        </div>
        <div className="no-scrollbar relative mt-3 flex gap-2 overflow-x-auto">
          {sorted.map((i) => (
            <div key={i.skin.id} className={`rarity-${i.skin.rarity} relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border hairline bg-surface`} title={i.skin.name}>
              <div className="rarity-glow absolute inset-0" />
              <img src={i.skin.thumbnail} alt="" className="relative h-full w-full object-contain p-1" />
              <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: RARITY_HEX[i.skin.rarity] }} />
            </div>
          ))}
          {items.length === 0 && <p className="py-4 text-xs text-muted">Keysni to'ldirish uchun pastdan skin qo'shing.</p>}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Keys nomi *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} disabled={!canEdit} />
        </Field>
        <Field label="Keys narxi (virtual tanga) *" hint="Faqat bepul ilova tangalari bilan">
          <Input type="number" min={0} step={1} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} disabled={!canEdit} />
        </Field>
        <Field label="Tavsif" className="sm:col-span-2">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} disabled={!canEdit} />
        </Field>
        <Field label="Keys rasmi" hint="PNG/JPG/WEBP — avtomatik optimallashadi">
          <div className="flex gap-2">
            <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} disabled={!canEdit} />
            <label className="btn btn-secondary shrink-0 cursor-pointer px-3" aria-label="Keys rasmini yuklash">
              {uploading ? <Spinner /> : <Icon name="upload" size={17} />}
              <input
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                disabled={!canEdit}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try {
                    const up = await uploadImage(f);
                    setForm((s) => ({ ...s, image: up.optimizedUrl }));
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : "Yuklashda xatolik");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Asosiy rang">
            <Input type="color" value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} className="h-11 p-1" disabled={!canEdit} />
          </Field>
          <Field label="Tartib raqami">
            <Input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} disabled={!canEdit} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Mavjudlik</p>
            <Segmented value={form.active ? "on" : "off"} onChange={(v) => setForm({ ...form, active: v === "on" })} options={[{ value: "on", label: "Faol" }, { value: "off", label: "O'chirilgan" }]} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Bosh sahifada</p>
            <Segmented value={form.featured ? "y" : "n"} onChange={(v) => setForm({ ...form, featured: v === "y" })} options={[{ value: "y", label: "Ha" }, { value: "n", label: "Yo'q" }]} />
          </div>
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Skinlar va tushish og'irliklari</p>
          <p className="text-xs text-muted">Ehtimol = og'irlik ÷ jami og'irlik ({fmt(total)}). To'liq ochiq, hech qachon yashirin o'zgartirilmaydi.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border hairline">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface2 text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Skin</th>
                <th className="px-3 py-2 text-left">Noyoblik</th>
                <th className="px-3 py-2 text-left">Virtual narx</th>
                <th className="px-3 py-2 text-left">Tushish og'irligi</th>
                <th className="px-3 py-2 text-right">Ehtimol</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.skin.id} className="border-t hairline">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <img src={i.skin.thumbnail} alt="" className="h-8 w-12 object-contain" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{i.skin.name}</p>
                        <p className="truncate text-[11px] text-muted">{i.skin.weaponName}{!i.skin.active && " · nofaol (chiqarilgan)"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2"><RarityPill rarity={i.skin.rarity} /></td>
                  <td className="px-3 py-2 tabular-nums"><span className="inline-flex items-center gap-1"><CoinIcon size={12} />{fmt(i.skin.virtualPrice)}</span></td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={i.weight}
                      disabled={!canEdit}
                      onChange={(e) => setItems((arr) => arr.map((x) => (x.skin.id === i.skin.id ? { ...x, weight: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : x)))}
                      className="h-9 min-h-0 w-28"
                      aria-label={`${i.skin.name} uchun og'irlik`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{total ? pct(i.weight / total) : "—"}</td>
                  <td className="px-1">
                    {canEdit && <IconButton icon="close" label="Olib tashlash" tone="danger" onClick={() => setItems((arr) => arr.filter((x) => x.skin.id !== i.skin.id))} />}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted">Hali skin biriktirilmagan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="mt-3 rounded-xl border hairline p-3">
            <Input value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} placeholder="Qo'shish uchun skin qidiring…" />
            <div className="mt-2 flex flex-wrap gap-2">
              {candidates.map((s) => (
                <button key={s.id} type="button" onClick={() => setItems((arr) => [...arr, { skin: s, weight: DEFAULT_WEIGHT[s.rarity] }])} className="chip">
                  <span className="h-2 w-2 rounded-full" style={{ background: RARITY_HEX[s.rarity] }} />
                  {s.name}
                  <span className="text-[11px] opacity-60">{s.weaponName}</span>
                  <Icon name="plus" size={13} />
                </button>
              ))}
              {allSkins.isLoading && <Spinner className="text-muted" />}
            </div>
          </div>
        )}
      </section>

      {id && (
        <section>
          <button type="button" className="btn btn-secondary text-sm" onClick={simulate} disabled={simBusy}>
            {simBusy ? <Spinner /> : <Icon name="sparkle" size={16} />} Simulate 5,000 openings (no effect on players)
          </button>
          {sim && (
            <div className="mt-3 space-y-1.5">
              {sim.map((r) => (
                <div key={r.skin.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-xs">
                  <span className="truncate">{r.skin.name}</span>
                  <span className="tabular-nums text-muted">kutilgan {pct(r.expected)}</span>
                  <span className="tabular-nums">haqiqiy {pct(r.observed)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {canEdit && (
        <div className="sticky bottom-0 -mx-5 border-t hairline bg-surface px-5 py-3">
          <button type="button" className="btn btn-primary w-full" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : "Keysni saqlash"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Cases({ me }: { me: AdminMe }) {
  const qc = useQueryClient();
  const canEdit = me.role !== "viewer";
  const [editing, setEditing] = useState<number | null | "new">(null);
  const q = useQuery({ queryKey: ["admin", "cases"], queryFn: () => adminApi.get<{ rows: CaseRow[] }>("/cases").then((r) => r.rows) });

  const columns: Column<CaseRow>[] = [
    { key: "img", header: "Keys", render: (c) => <div className="flex items-center gap-3"><img src={c.image} alt="" className="h-10 w-10 object-contain" /><span className="font-medium">{c.name}</span></div> },
    { key: "cost", header: "Narx", render: (c) => <span className="inline-flex items-center gap-1 tabular-nums"><CoinIcon size={12} />{fmt(c.cost)}</span> },
    { key: "items", header: "Skinlar", render: (c) => c.itemCount },
    { key: "open", header: "Ochilishlar", render: (c) => fmt(c.openings), hideOnMobile: true },
    { key: "feat", header: "Tanlangan", render: (c) => (c.featured ? <span className="text-coin">★</span> : <span className="text-muted">—</span>), hideOnMobile: true },
    { key: "status", header: "Holat", render: (c) => <StatusPill active={c.active} off="O'chirilgan" /> },
    {
      key: "act",
      header: "",
      className: "text-right",
      render: (c) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <IconButton icon={canEdit ? "edit" : "eye"} label={canEdit ? "Tahrirlash" : "Ko'rish"} onClick={() => setEditing(c.id)} />
          {canEdit && c.active && (
            <IconButton icon="trash" label="O'chirish" tone="danger" onClick={async () => { await adminApi.del(`/cases/${c.id}`); void qc.invalidateQueries({ queryKey: ["admin", "cases"] }); }} />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Keyslar"
        subtitle="Skinlarni biriktiring, tushish og'irliklarini belgilang va ehtimollarni ko'ring. Natija har doim serverda aniqlanadi."
        actions={canEdit && <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={18} /> Yangi keys</button>}
      />
      <DataTable columns={columns} rows={q.data} loading={q.isLoading} error={q.isError ? "Keyslarni yuklab bo'lmadi." : null} onRetry={() => void q.refetch()} rowKey={(c) => c.id} onRowClick={(c) => setEditing(c.id)} />
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Yangi keys" : "Keysni tahrirlash"} variant="dialog" maxWidth="56rem">
        {editing !== null && (
          <CaseEditor
            key={String(editing)}
            id={editing === "new" ? null : editing}
            canEdit={canEdit}
            onSaved={() => {
              void qc.invalidateQueries({ queryKey: ["admin", "cases"] });
              void qc.invalidateQueries({ queryKey: ["admin", "skins"] });
            }}
          />
        )}
      </Sheet>
    </>
  );
}

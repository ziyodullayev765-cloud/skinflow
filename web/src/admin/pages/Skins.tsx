import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { CoinIcon, Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { fmt, shortDate } from "../../lib/format";
import { useDebounced } from "../../lib/hooks";
import { RARITIES, WEAPONS } from "../../lib/rarity";
import type { Rarity } from "../../lib/types";
import type { AdminMe } from "../AdminApp";
import { adminApi, uploadImage, type AdminSkin, type Paged } from "../api";
import { DataTable, type Column } from "../components/DataTable";
import { ImageDrop } from "../components/ImageDrop";
import { Field, IconButton, Input, Notice, PageHeader, RARITY_UZ, RarityPill, Segmented, Select, StatusPill, SuccessCheck, Textarea } from "../components/kit";

export const MAX_VIRTUAL_PRICE = 1_000_000_000;

/** Suggested CS2 weapon names per type (admins can type anything). */
const WEAPON_SUGGESTIONS: Record<string, string[]> = {
  rifle: ["AK-47", "M4A4", "M4A1-S", "AUG", "SG 553", "FAMAS", "Galil AR"],
  sniper: ["AWP", "SSG 08", "SCAR-20", "G3SG1"],
  pistol: ["Desert Eagle", "Glock-18", "USP-S", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto", "Dual Berettas", "R8 Revolver", "P2000"],
  smg: ["P90", "MP9", "MAC-10", "MP7", "MP5-SD", "UMP-45", "PP-Bizon"],
  shotgun: ["Nova", "XM1014", "MAG-7", "Sawed-Off"],
  knife: ["★ Karambit", "★ Butterfly Knife", "★ M9 Bayonet", "★ Bayonet", "★ Talon Knife", "★ Skeleton Knife", "★ Flip Knife", "★ Gut Knife", "★ Huntsman Knife", "★ Falchion Knife", "★ Bowie Knife", "★ Shadow Daggers", "★ Stiletto Knife", "★ Ursus Knife", "★ Navaja Knife", "★ Classic Knife", "★ Paracord Knife", "★ Survival Knife", "★ Nomad Knife", "★ Kukri Knife"],
  gloves: ["★ Sport Gloves", "★ Driver Gloves", "★ Specialist Gloves", "★ Moto Gloves", "★ Hand Wraps", "★ Hydra Gloves", "★ Broken Fang Gloves", "★ Bloodhound Gloves"],
};

interface WeaponNameRow {
  name: string;
  type: string;
  skins: number;
}

/** Bulk-rename a weapon across all skins. */
function WeaponNames({ onChanged }: { onChanged: () => void }) {
  const q = useQuery({ queryKey: ["admin", "weapon-names"], queryFn: () => adminApi.get<{ rows: WeaponNameRow[] }>("/weapon-names").then((r) => r.rows) });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (from: string) => {
    const to = (edits[from] ?? "").trim();
    if (!to || to === from) return;
    setBusy(from);
    try {
      const r = await adminApi.put<{ updated: number }>("/weapon-names", { from, to });
      setMsg({ tone: "info", text: `“${from}” → “${to}” (${r.updated} skins)` });
      setEdits((e) => ({ ...e, [from]: "" }));
      void q.refetch();
      onChanged();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Nomni o'zgartirib bo'lmadi" });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3 pt-1">
      <p className="text-sm text-muted">Qurol nomini bir marta o'zgartiring — uni ishlatadigan barcha skinlar yangilanadi.</p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <ul className="divide-y divide-white/[0.06]">
        {(q.data ?? []).map((w) => (
          <li key={w.name} className="flex flex-wrap items-center gap-2 py-2.5">
            <div className="min-w-[150px] flex-1">
              <p className="font-medium">{w.name}</p>
              <p className="text-[11px] text-muted">{WEAPON_LABEL[w.type]} · {w.skins} ta skin</p>
            </div>
            <Input
              className="h-10 min-h-0 w-48"
              placeholder="Yangi nom"
              value={edits[w.name] ?? ""}
              onChange={(e) => setEdits({ ...edits, [w.name]: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && void save(w.name)}
              list={`wn-${w.type}`}
              maxLength={60}
            />
            <datalist id={`wn-${w.type}`}>{(WEAPON_SUGGESTIONS[w.type] ?? []).map((n) => <option key={n} value={n} />)}</datalist>
            <button type="button" className="btn btn-secondary h-10 min-h-0 text-sm" disabled={!edits[w.name]?.trim() || busy === w.name} onClick={() => void save(w.name)}>
              {busy === w.name ? <Spinner /> : "O'zgartirish"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
const WEAPON_LABEL: Record<string, string> = { rifle: "Avtomat", smg: "Pistolet-pulemyot", pistol: "To'pponcha", sniper: "Snayper", shotgun: "Drobovik", knife: "Pichoq", gloves: "Qo'lqop" };

interface Collection {
  id: number;
  name: string;
  skin_count: number;
}

interface FormState {
  name: string;
  weaponType: string;
  weaponName: string;
  rarity: Rarity | "";
  virtualPrice: string;
  description: string;
  collectionId: string; // "" | id | "__new"
  newCollection: string;
  active: boolean;
  featured: boolean;
  uploadId: string | null;
  preview: string | null;
}

const EMPTY: FormState = {
  name: "",
  weaponType: "",
  weaponName: "",
  rarity: "",
  virtualPrice: "",
  description: "",
  collectionId: "",
  newCollection: "",
  active: true,
  featured: false,
  uploadId: null,
  preview: null,
};

/** Client-side mirror of server validation (server remains the source of truth). */
export function validateSkinForm(f: FormState, creating: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.name.trim().length < 2) e.name = "Skin nomi majburiy (kamida 2 belgi)";
  else if (f.name.trim().length > 60) e.name = "Ko'pi bilan 60 belgi";
  if (!f.weaponType) e.weaponType = "Qurol turi majburiy";
  if (!f.rarity) e.rarity = "Noyoblik majburiy";
  const price = Number(f.virtualPrice);
  if (!f.virtualPrice || !Number.isInteger(price) || price <= 0) e.virtualPrice = "Virtual narx musbat butun son bo'lishi kerak";
  else if (price > MAX_VIRTUAL_PRICE) e.virtualPrice = `Maksimal ${fmt(MAX_VIRTUAL_PRICE)} tanga`;
  if (f.description.length > 500) e.description = "Ko'pi bilan 500 belgi";
  if (f.collectionId === "__new" && f.newCollection.trim().length < 2) e.newCollection = "Kolleksiya nomini kiriting";
  if (creating && !f.uploadId) e.image = "Rasm majburiy";
  return e;
}

function Preview({ f }: { f: FormState }) {
  const r = (f.rarity || "common") as Rarity;
  return (
    <div className={`rarity-${r} relative overflow-hidden rounded-2xl border hairline bg-bg p-4`}>
      <div className="rarity-glow absolute inset-0" />
      {r !== "common" && f.preview && <div className="shine-sweep" />}
      <div className="relative grid aspect-[16/10] place-items-center">
        {f.preview ? <img src={f.preview} alt="" className="h-full w-full object-contain" /> : <Icon name="skins" size={40} className="text-muted/40" />}
      </div>
      <div className="rarity-bar relative my-3 h-px" />
      <p className="relative text-[11px] uppercase tracking-wider text-muted">{f.weaponName || (f.weaponType ? WEAPON_LABEL[f.weaponType] : "Qurol turi")}</p>
      <p className="relative truncate font-display text-lg font-semibold">{f.name || "Skin nomi"}</p>
      <div className="relative mt-2 flex items-center justify-between">
        {f.rarity ? <RarityPill rarity={f.rarity} /> : <span className="text-xs text-muted">Noyoblik</span>}
        <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
          <CoinIcon size={13} />
          {f.virtualPrice ? fmt(Number(f.virtualPrice) || 0) : "—"}
        </span>
      </div>
      <p className="relative mt-1.5 truncate text-xs text-muted">{f.collectionId === "__new" ? f.newCollection || "Yangi kolleksiya" : f.collectionId ? "Kolleksiya tanlandi" : "Kolleksiyasiz"}</p>
      <div className="relative mt-2 flex gap-1.5">
        <span className={clsx("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", f.active ? "bg-success/15 text-success" : "bg-white/5 text-muted")}>{f.active ? "FAOL" : "NOFAOL"}</span>
        {f.featured && <span className="rounded-md bg-coin/15 px-1.5 py-0.5 text-[10px] font-semibold text-coin">TANLANGAN</span>}
      </div>
    </div>
  );
}

function SkinForm({ editing, collections, onSaved }: { editing: AdminSkin | null; collections: Collection[]; onSaved: (s: AdminSkin, created: boolean) => void }) {
  const [f, setF] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setErrors({});
    setServerErr(null);
    setSuccess(false);
    setF(
      editing
        ? {
            name: editing.name,
            weaponType: editing.weaponType,
            weaponName: editing.weaponName,
            rarity: editing.rarity,
            virtualPrice: String(editing.virtualPrice),
            description: editing.description,
            collectionId: editing.collectionId ? String(editing.collectionId) : "",
            newCollection: "",
            active: editing.active,
            featured: editing.featured,
            uploadId: null,
            preview: editing.image,
          }
        : EMPTY,
    );
  }, [editing]);

  const set = (p: Partial<FormState>) => setF((s) => ({ ...s, ...p }));
  const collectionName = collections.find((c) => String(c.id) === f.collectionId)?.name;

  // Clear the "not saved" message as soon as the admin edits the form again.
  useEffect(() => {
    setServerErr(null);
  }, [f.name, f.weaponType, f.rarity, f.virtualPrice, f.description, f.collectionId, f.newCollection, f.uploadId]);

  const onFile = async (file: File) => {
    const local = URL.createObjectURL(file);
    set({ preview: local, uploadId: null });
    setUploading(true);
    setUploadErr(null);
    try {
      const up = await uploadImage(file);
      set({ uploadId: up.id, preview: up.optimizedUrl });
      setErrors((e) => ({ ...e, image: "" }));
    } catch (e) {
      setUploadErr(e instanceof ApiError ? e.message : "Yuklashda xatolik");
      set({ preview: editing?.image ?? null });
    } finally {
      setUploading(false);
      URL.revokeObjectURL(local);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateSkinForm(f, !editing);
    setErrors(v);
    const firstError = Object.entries(v).find(([, msg]) => msg);
    if (firstError) {
      // Make the problem visible: banner at the top + scroll to the field.
      setServerErr(`Saqlanmadi: ${firstError[1]}`);
      requestAnimationFrame(() => {
        const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${firstError[0]}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
      });
      return;
    }
    setSaving(true);
    setServerErr(null);
    const body = {
      name: f.name.trim(),
      weaponType: f.weaponType,
      weaponName: f.weaponName.trim() || undefined,
      rarity: f.rarity,
      virtualPrice: Number(f.virtualPrice),
      description: f.description.trim(),
      collectionId: f.collectionId && f.collectionId !== "__new" ? Number(f.collectionId) : null,
      newCollection: f.collectionId === "__new" ? f.newCollection.trim() : undefined,
      uploadId: f.uploadId ?? undefined,
      active: f.active,
      featured: f.featured,
    };
    try {
      const r = editing ? await adminApi.put<{ skin: AdminSkin }>(`/skins/${editing.id}`, body) : await adminApi.post<{ skin: AdminSkin }>("/skins", body);
      setSuccess(true);
      onSaved(r.skin, !editing);
      if (!editing) {
        setTimeout(() => {
          setF(EMPTY);
          setSuccess(false);
        }, 1400);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setServerErr(err.message);
        const d = err.details as { path: string; message: string }[] | undefined;
        if (Array.isArray(d)) setErrors(Object.fromEntries(d.map((x) => [x.path === "uploadId" ? "image" : x.path, x.message])));
      } else setServerErr("Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  if (success && !editing) return <SuccessCheck label="Skin yaratildi" />;

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-5 pt-1 md:grid-cols-[1fr_260px]" noValidate>
      <div className="space-y-4">
        {serverErr && <Notice tone="error">{serverErr}</Notice>}
        <Field field="image" label="Skin rasmi" error={errors.image}>
          <ImageDrop preview={f.preview} onFile={onFile} uploading={uploading} error={uploadErr} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field field="name" label="Skin nomi *" error={errors.name}>
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Carbon Pulse" maxLength={60} />
          </Field>
          <Field field="weaponType" label="Qurol turi *" error={errors.weaponType}>
            <Select value={f.weaponType} onChange={(e) => set({ weaponType: e.target.value })}>
              <option value="">Tanlang…</option>
              {WEAPONS.map((w) => (
                <option key={w} value={w}>
                  {WEAPON_LABEL[w]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Qurol nomi" hint="Ro'yxatdan tanlang yoki istalgan nom yozing">
            <Input value={f.weaponName} onChange={(e) => set({ weaponName: e.target.value })} placeholder="AK-47" maxLength={60} list="cs2-weapons" />
            <datalist id="cs2-weapons">
              {(WEAPON_SUGGESTIONS[f.weaponType] ?? Object.values(WEAPON_SUGGESTIONS).flat()).map((w) => (
                <option key={w} value={w} />
              ))}
            </datalist>
          </Field>
          <Field field="rarity" label="Noyoblik *" error={errors.rarity}>
            <Select value={f.rarity} onChange={(e) => set({ rarity: e.target.value as Rarity })}>
              <option value="">Tanlang…</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {RARITY_UZ[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field field="virtualPrice" label="Virtual narx (tanga) *" error={errors.virtualPrice} hint="Faqat ilova ichidagi virtual qiymat — haqiqiy pul emas">
            <div className="relative">
              <CoinIcon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input type="number" inputMode="numeric" min={1} max={MAX_VIRTUAL_PRICE} step={1} value={f.virtualPrice} onChange={(e) => set({ virtualPrice: e.target.value })} placeholder="1000" className="pl-10" />
            </div>
          </Field>
          <Field field="newCollection" label="Kolleksiya" error={errors.newCollection}>
            <Select value={f.collectionId} onChange={(e) => set({ collectionId: e.target.value })}>
              <option value="">Kolleksiyasiz</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.skin_count})
                </option>
              ))}
              <option value="__new">+ Yangi kolleksiya yaratish…</option>
            </Select>
            {f.collectionId === "__new" && <Input className="mt-2" value={f.newCollection} onChange={(e) => set({ newCollection: e.target.value })} placeholder="Yangi kolleksiya nomi" maxLength={60} autoFocus />}
          </Field>
        </div>
        <Field field="description" label={`Tavsif (${f.description.length}/500)`} error={errors.description}>
          <Textarea value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={500} placeholder="Skin haqida qisqacha tavsif." />
        </Field>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Holat</p>
            <Segmented value={f.active ? "on" : "off"} onChange={(v) => set({ active: v === "on" })} options={[{ value: "on", label: "Faol" }, { value: "off", label: "Nofaol" }]} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Tanlangan</p>
            <Segmented value={f.featured ? "yes" : "no"} onChange={(v) => set({ featured: v === "yes" })} options={[{ value: "yes", label: "Ha" }, { value: "no", label: "Yo'q" }]} />
          </div>
        </div>
      </div>
      <div className="md:sticky md:top-0 md:self-start">
        <p className="mb-1.5 text-xs font-medium text-muted">Jonli ko'rinish</p>
        <Preview f={{ ...f, newCollection: f.collectionId === "__new" ? f.newCollection : collectionName ?? "", collectionId: f.collectionId ? "__new" : "" }} />
        <button type="submit" className="btn btn-primary mt-4 w-full" disabled={saving || uploading}>
          {saving ? <Spinner /> : editing ? "O'zgarishlarni saqlash" : "Skin yaratish"}
        </button>
        {success && editing && <p className="mt-2 text-center text-xs text-success">Saqlandi ✓</p>}
        {serverErr && <p className="mt-2 text-center text-xs text-danger" role="alert">{serverErr}</p>}
      </div>
    </form>
  );
}

export default function Skins({ me }: { me: AdminMe }) {
  const qc = useQueryClient();
  const canEdit = me.role !== "viewer";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 250);
  const [rarity, setRarity] = useState("");
  const [weapon, setWeapon] = useState("");
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSkin | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminSkin | null>(null);
  const [namesOpen, setNamesOpen] = useState(false);

  useEffect(() => setPage(1), [q, rarity, weapon, status]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q) p.set("q", q);
    if (rarity) p.set("rarity", rarity);
    if (weapon) p.set("weaponType", weapon);
    if (status) p.set("status", status);
    return p.toString();
  }, [page, q, rarity, weapon, status]);

  const skins = useQuery({ queryKey: ["admin", "skins", params], queryFn: () => adminApi.get<Paged<AdminSkin>>(`/skins?${params}`), placeholderData: (p) => p });
  const collections = useQuery({ queryKey: ["admin", "collections"], queryFn: () => adminApi.get<{ rows: Collection[] }>("/collections").then((r) => r.rows) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "skins"] });
    void qc.invalidateQueries({ queryKey: ["admin", "collections"] });
  };
  const flash = (tone: "info" | "error", text: string) => {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 3500);
  };

  const action = useMutation({
    mutationFn: async ({ kind, skin }: { kind: "duplicate" | "toggle" | "delete"; skin: AdminSkin }) => {
      if (kind === "duplicate") return adminApi.post<{ skin: AdminSkin }>(`/skins/${skin.id}/duplicate`);
      if (kind === "toggle") return adminApi.patch<{ skin: AdminSkin }>(`/skins/${skin.id}/status`, { active: !skin.active });
      return adminApi.del(`/skins/${skin.id}`);
    },
    onSuccess: (r, { kind, skin }) => {
      refresh();
      if (kind === "duplicate") {
        setHighlight((r as { skin: AdminSkin }).skin.id);
        flash("info", `“${skin.name}” nusxalandi (nofaol nusxa yaratildi)`);
      } else if (kind === "delete") flash("info", `“${skin.name}” o'chirildi`);
    },
    onError: (e) => flash("error", e instanceof ApiError ? e.message : "Amal bajarilmadi"),
  });

  const columns: Column<AdminSkin>[] = [
    {
      key: "image",
      header: "Rasm",
      render: (s) => (
        <div className={`rarity-${s.rarity} relative h-11 w-16 overflow-hidden rounded-lg bg-surface2`}>
          <div className="rarity-glow absolute inset-0" />
          <img src={s.thumbnail} alt="" loading="lazy" className="relative h-full w-full object-contain p-1" />
        </div>
      ),
    },
    { key: "name", header: "Nomi", render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "weapon", header: "Qurol", render: (s) => <span className="text-muted">{s.weaponName}<span className="block text-[11px] opacity-70">{WEAPON_LABEL[s.weaponType]}</span></span> },
    { key: "rarity", header: "Noyoblik", render: (s) => <RarityPill rarity={s.rarity} /> },
    { key: "price", header: "Virtual narx", render: (s) => <span className="inline-flex items-center gap-1 tabular-nums"><CoinIcon size={12} />{fmt(s.virtualPrice)}</span> },
    { key: "collection", header: "Kolleksiya", render: (s) => <span className="text-muted">{s.collection}</span>, hideOnMobile: true },
    { key: "status", header: "Holat", render: (s) => <StatusPill active={s.active} /> },
    { key: "featured", header: "Tanlangan", render: (s) => (s.featured ? <span className="text-coin">★ Ha</span> : <span className="text-muted">Yo'q</span>), hideOnMobile: true },
    { key: "created", header: "Yaratilgan", render: (s) => <span className="whitespace-nowrap text-xs text-muted">{shortDate(s.createdAt)}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: "Amallar",
      className: "text-right",
      render: (s) =>
        canEdit ? (
          <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <IconButton icon="edit" label="Tahrirlash" onClick={() => { setEditing(s); setFormOpen(true); }} />
            <IconButton icon="copy" label="Nusxalash" onClick={() => action.mutate({ kind: "duplicate", skin: s })} />
            <IconButton icon={s.active ? "eye" : "check"} label={s.active ? "O'chirish" : "Faollashtirish"} onClick={() => action.mutate({ kind: "toggle", skin: s })} />
            <IconButton icon="trash" label="O'chirish" tone="danger" onClick={() => setConfirmDel(s)} />
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Skinlar"
        subtitle="Rasm yuklang, noyoblik va ilova ichidagi virtual narxni belgilang."
        actions={
          canEdit && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setNamesOpen(true)}>
                <Icon name="edit" size={18} /> Qurol nomlari
              </button>
              <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Icon name="plus" size={18} /> Yangi skin qo'shish
              </button>
            </>
          )
        }
      />
      <AnimatePresence>
        {notice && (
          <motion.div className="mb-4" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Notice tone={notice.tone}>{notice.text}</Notice>
          </motion.div>
        )}
      </AnimatePresence>
      <DataTable
        columns={columns}
        rows={skins.data?.rows.map((r) => r)}
        loading={skins.isLoading}
        error={skins.isError ? "Skinlarni yuklab bo'lmadi." : null}
        onRetry={() => void skins.refetch()}
        rowKey={(s) => s.id}
        onRowClick={canEdit ? (s) => { setEditing(s); setFormOpen(true); } : undefined}
        search={{ value: search, onChange: setSearch, placeholder: "Nom, qurol yoki kolleksiya bo'yicha qidirish…" }}
        filters={
          <>
            <Select value={rarity} onChange={(e) => setRarity(e.target.value)} className="w-auto" aria-label="Noyoblik filtri">
              <option value="">Barcha noyobliklar</option>
              {RARITIES.map((r) => <option key={r} value={r}>{RARITY_UZ[r]}</option>)}
            </Select>
            <Select value={weapon} onChange={(e) => setWeapon(e.target.value)} className="w-auto" aria-label="Qurol filtri">
              <option value="">Barcha qurollar</option>
              {WEAPONS.map((w) => <option key={w} value={w}>{WEAPON_LABEL[w]}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label="Holat filtri">
              <option value="">Har qanday holat</option>
              <option value="active">Faol</option>
              <option value="inactive">Nofaol</option>
            </Select>
          </>
        }
        page={page}
        pageSize={20}
        total={skins.data?.total}
        onPage={setPage}
        empty="Bu filtrlarga mos skin yo'q."
      />
      {highlight && <span className="sr-only">Skin {highlight} added</span>}

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Skinni tahrirlash · ${editing.name}` : "Yangi skin qo'shish"} variant="dialog" maxWidth="52rem">
        <SkinForm
          editing={editing}
          collections={collections.data ?? []}
          onSaved={(s, created) => {
            refresh();
            setHighlight(s.id);
            if (created) flash("info", `“${s.name}” yaratildi`);
            else {
              setEditing(s);
              flash("info", `“${s.name}” saqlandi`);
            }
          }}
        />
      </Sheet>

      <Sheet open={namesOpen} onClose={() => setNamesOpen(false)} title="Qurol nomlari" variant="dialog" maxWidth="34rem">
        {namesOpen && <WeaponNames onChanged={refresh} />}
      </Sheet>

      <Sheet open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Skin o'chirilsinmi?" variant="dialog" maxWidth="24rem">
        {confirmDel && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Butunlay o'chirilsinmi: <b className="text-fg">{confirmDel.name}</b>? O'yinchilarda bor skinlarni o'chirib bo'lmaydi — ularni nofaol qiling.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Bekor qilish</button>
              <button
                type="button"
                className="btn bg-danger text-white"
                onClick={() => {
                  action.mutate({ kind: "delete", skin: confirmDel });
                  setConfirmDel(null);
                }}
              >
                O'chirish
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { Field, IconButton, Input, Notice, PageHeader, RarityPill, Segmented, Select, StatusPill, SuccessCheck, Textarea } from "../components/kit";

export const MAX_VIRTUAL_PRICE = 1_000_000;
const WEAPON_LABEL: Record<string, string> = { rifle: "Rifle", smg: "SMG", pistol: "Pistol", sniper: "Sniper", shotgun: "Shotgun", knife: "Knife", gloves: "Gloves" };

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
  if (f.name.trim().length < 2) e.name = "Skin name is required (min 2 characters)";
  else if (f.name.trim().length > 60) e.name = "Max 60 characters";
  if (!f.weaponType) e.weaponType = "Weapon type is required";
  if (!f.rarity) e.rarity = "Rarity is required";
  const price = Number(f.virtualPrice);
  if (!f.virtualPrice || !Number.isInteger(price) || price <= 0) e.virtualPrice = "Virtual price must be a positive whole number";
  else if (price > MAX_VIRTUAL_PRICE) e.virtualPrice = `Maximum is ${fmt(MAX_VIRTUAL_PRICE)} coins`;
  if (f.description.length > 500) e.description = "Max 500 characters";
  if (f.collectionId === "__new" && f.newCollection.trim().length < 2) e.newCollection = "Enter a collection name";
  if (creating && !f.uploadId) e.image = "Image is required";
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
      <p className="relative text-[11px] uppercase tracking-wider text-muted">{f.weaponName || (f.weaponType ? WEAPON_LABEL[f.weaponType] : "Weapon type")}</p>
      <p className="relative truncate font-display text-lg font-semibold">{f.name || "Skin name"}</p>
      <div className="relative mt-2 flex items-center justify-between">
        {f.rarity ? <RarityPill rarity={f.rarity} /> : <span className="text-xs text-muted">Rarity</span>}
        <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
          <CoinIcon size={13} />
          {f.virtualPrice ? fmt(Number(f.virtualPrice) || 0) : "—"}
        </span>
      </div>
      <p className="relative mt-1.5 truncate text-xs text-muted">{f.collectionId === "__new" ? f.newCollection || "New collection" : f.collectionId ? "Collection selected" : "No collection"}</p>
      <div className="relative mt-2 flex gap-1.5">
        <span className={clsx("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", f.active ? "bg-success/15 text-success" : "bg-white/5 text-muted")}>{f.active ? "ACTIVE" : "INACTIVE"}</span>
        {f.featured && <span className="rounded-md bg-coin/15 px-1.5 py-0.5 text-[10px] font-semibold text-coin">FEATURED</span>}
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
      setUploadErr(e instanceof ApiError ? e.message : "Upload failed");
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
    if (Object.values(v).some(Boolean)) return;
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
      } else setServerErr("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (success && !editing) return <SuccessCheck label="Skin created" />;

  return (
    <form onSubmit={submit} className="grid gap-5 pt-1 md:grid-cols-[1fr_260px]" noValidate>
      <div className="space-y-4">
        {serverErr && <Notice tone="error">{serverErr}</Notice>}
        <Field label="Skin image" error={errors.image}>
          <ImageDrop preview={f.preview} onFile={onFile} uploading={uploading} error={uploadErr} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Skin name *" error={errors.name}>
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Carbon Pulse" maxLength={60} />
          </Field>
          <Field label="Weapon type *" error={errors.weaponType}>
            <Select value={f.weaponType} onChange={(e) => set({ weaponType: e.target.value })}>
              <option value="">Select…</option>
              {WEAPONS.map((w) => (
                <option key={w} value={w}>
                  {WEAPON_LABEL[w]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Weapon model name" hint="Optional — defaults to the weapon type">
            <Input value={f.weaponName} onChange={(e) => set({ weaponName: e.target.value })} placeholder="Vektor R7" maxLength={60} />
          </Field>
          <Field label="Rarity *" error={errors.rarity}>
            <Select value={f.rarity} onChange={(e) => set({ rarity: e.target.value as Rarity })}>
              <option value="">Select…</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r[0].toUpperCase() + r.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Virtual price (coins) *" error={errors.virtualPrice} hint="Fictional in-app value only — never real money">
            <div className="relative">
              <CoinIcon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input type="number" inputMode="numeric" min={1} max={MAX_VIRTUAL_PRICE} step={1} value={f.virtualPrice} onChange={(e) => set({ virtualPrice: e.target.value })} placeholder="1000" className="pl-10" />
            </div>
          </Field>
          <Field label="Collection" error={errors.newCollection}>
            <Select value={f.collectionId} onChange={(e) => set({ collectionId: e.target.value })}>
              <option value="">No collection</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.skin_count})
                </option>
              ))}
              <option value="__new">+ Create new collection…</option>
            </Select>
            {f.collectionId === "__new" && <Input className="mt-2" value={f.newCollection} onChange={(e) => set({ newCollection: e.target.value })} placeholder="New collection name" maxLength={60} autoFocus />}
          </Field>
        </div>
        <Field label={`Description (${f.description.length}/500)`} error={errors.description}>
          <Textarea value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={500} placeholder="A short description of the finish." />
        </Field>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Status</p>
            <Segmented value={f.active ? "on" : "off"} onChange={(v) => set({ active: v === "on" })} options={[{ value: "on", label: "Active" }, { value: "off", label: "Inactive" }]} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Featured</p>
            <Segmented value={f.featured ? "yes" : "no"} onChange={(v) => set({ featured: v === "yes" })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          </div>
        </div>
      </div>
      <div className="md:sticky md:top-0 md:self-start">
        <p className="mb-1.5 text-xs font-medium text-muted">Live preview</p>
        <Preview f={{ ...f, newCollection: f.collectionId === "__new" ? f.newCollection : collectionName ?? "", collectionId: f.collectionId ? "__new" : "" }} />
        <button type="submit" className="btn btn-primary mt-4 w-full" disabled={saving || uploading}>
          {saving ? <Spinner /> : editing ? "Save changes" : "Create Skin"}
        </button>
        {success && editing && <p className="mt-2 text-center text-xs text-success">Saved ✓</p>}
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
        flash("info", `Duplicated “${skin.name}” (inactive copy created)`);
      } else if (kind === "delete") flash("info", `Deleted “${skin.name}”`);
    },
    onError: (e) => flash("error", e instanceof ApiError ? e.message : "Action failed"),
  });

  const columns: Column<AdminSkin>[] = [
    {
      key: "image",
      header: "Image",
      render: (s) => (
        <div className={`rarity-${s.rarity} relative h-11 w-16 overflow-hidden rounded-lg bg-surface2`}>
          <div className="rarity-glow absolute inset-0" />
          <img src={s.thumbnail} alt="" loading="lazy" className="relative h-full w-full object-contain p-1" />
        </div>
      ),
    },
    { key: "name", header: "Name", render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "weapon", header: "Weapon", render: (s) => <span className="text-muted">{s.weaponName}<span className="block text-[11px] opacity-70">{WEAPON_LABEL[s.weaponType]}</span></span> },
    { key: "rarity", header: "Rarity", render: (s) => <RarityPill rarity={s.rarity} /> },
    { key: "price", header: "Virtual price", render: (s) => <span className="inline-flex items-center gap-1 tabular-nums"><CoinIcon size={12} />{fmt(s.virtualPrice)}</span> },
    { key: "collection", header: "Collection", render: (s) => <span className="text-muted">{s.collection}</span>, hideOnMobile: true },
    { key: "status", header: "Status", render: (s) => <StatusPill active={s.active} /> },
    { key: "featured", header: "Featured", render: (s) => (s.featured ? <span className="text-coin">★ Yes</span> : <span className="text-muted">No</span>), hideOnMobile: true },
    { key: "created", header: "Created", render: (s) => <span className="whitespace-nowrap text-xs text-muted">{shortDate(s.createdAt)}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (s) =>
        canEdit ? (
          <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <IconButton icon="edit" label="Edit" onClick={() => { setEditing(s); setFormOpen(true); }} />
            <IconButton icon="copy" label="Duplicate" onClick={() => action.mutate({ kind: "duplicate", skin: s })} />
            <IconButton icon={s.active ? "eye" : "check"} label={s.active ? "Deactivate" : "Activate"} onClick={() => action.mutate({ kind: "toggle", skin: s })} />
            <IconButton icon="trash" label="Delete" tone="danger" onClick={() => setConfirmDel(s)} />
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Skins"
        subtitle="Upload artwork, set rarity and the fictional in-app virtual price."
        actions={
          canEdit && (
            <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Icon name="plus" size={18} /> Add new skin
            </button>
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
        error={skins.isError ? "Couldn't load skins." : null}
        onRetry={() => void skins.refetch()}
        rowKey={(s) => s.id}
        onRowClick={canEdit ? (s) => { setEditing(s); setFormOpen(true); } : undefined}
        search={{ value: search, onChange: setSearch, placeholder: "Search name, weapon or collection…" }}
        filters={
          <>
            <Select value={rarity} onChange={(e) => setRarity(e.target.value)} className="w-auto" aria-label="Rarity filter">
              <option value="">All rarities</option>
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Select value={weapon} onChange={(e) => setWeapon(e.target.value)} className="w-auto" aria-label="Weapon filter">
              <option value="">All weapons</option>
              {WEAPONS.map((w) => <option key={w} value={w}>{WEAPON_LABEL[w]}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label="Status filter">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </>
        }
        page={page}
        pageSize={20}
        total={skins.data?.total}
        onPage={setPage}
        empty="No skins match these filters."
      />
      {highlight && <span className="sr-only">Skin {highlight} added</span>}

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit skin · ${editing.name}` : "Add new skin"} variant="dialog" maxWidth="52rem">
        <SkinForm
          editing={editing}
          collections={collections.data ?? []}
          onSaved={(s, created) => {
            refresh();
            setHighlight(s.id);
            if (created) flash("info", `Created “${s.name}”`);
            else {
              setEditing(s);
              flash("info", `Saved “${s.name}”`);
            }
          }}
        />
      </Sheet>

      <Sheet open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete skin?" variant="dialog" maxWidth="24rem">
        {confirmDel && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Permanently delete <b className="text-fg">{confirmDel.name}</b>? Skins that players already own can't be deleted — deactivate them instead.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button
                type="button"
                className="btn bg-danger text-white"
                onClick={() => {
                  action.mutate({ kind: "delete", skin: confirmDel });
                  setConfirmDel(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

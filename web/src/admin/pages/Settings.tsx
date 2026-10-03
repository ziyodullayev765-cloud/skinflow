import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api";
import type { AdminMe } from "../AdminApp";
import { adminApi } from "../api";
import { Field, Input, Notice, PageHeader, ROLE_UZ, Segmented, Select } from "../components/kit";

interface AppSettings {
  app_name: string;
  maintenance_mode: boolean;
  animation_intensity: "low" | "normal" | "high";
  daily_reward_amount: number;
  cases_enabled: boolean;
  min_app_version: string;
  starting_coins: number;
  open_cooldown_seconds: number;
}

interface AdminRow {
  id: number;
  username: string;
  email: string | null;
  telegram_id: number | null;
  role: string;
  active: boolean;
  last_login_at: string | null;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TelegramSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "telegram"], queryFn: () => adminApi.get<{ appBotConfigured: boolean; adminBotConfigured: boolean; allowedIds: string[]; linked: { id: number; username: string; telegram_id: number }[] }>("/telegram") });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ origin: string; results: Record<string, { configured: boolean; username?: string; error?: string }> } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Section title="Telegram botlar" subtitle="O'yinchi boti o'yinni, admin boti esa shu panelni Mini App sifatida ochadi.">
      {q.data && (
        <ul className="mb-4 space-y-1.5 text-sm">
          <li className="flex items-center gap-2"><Icon name={q.data.appBotConfigured ? "check" : "close"} size={16} className={q.data.appBotConfigured ? "text-success" : "text-danger"} /> O'yinchi boti tokeni {q.data.appBotConfigured ? "sozlangan" : "yo'q (TELEGRAM_BOT_TOKEN)"}</li>
          <li className="flex items-center gap-2"><Icon name={q.data.adminBotConfigured ? "check" : "close"} size={16} className={q.data.adminBotConfigured ? "text-success" : "text-danger"} /> Admin boti tokeni {q.data.adminBotConfigured ? "sozlangan" : "yo'q (ADMIN_TELEGRAM_BOT_TOKEN)"}</li>
          <li className="text-xs text-muted">Ruxsat etilgan admin Telegram ID'lari: {q.data.allowedIds.length ? q.data.allowedIds.join(", ") : "yo'q"} · Bog'langan: {q.data.linked.map((l) => `${l.username} (${l.telegram_id})`).join(", ") || "yo'q"}</li>
        </ul>
      )}
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
      {result && (
        <div className="mb-3 space-y-1 rounded-xl bg-surface2 p-3 text-xs">
          <p className="text-muted">Mini App manzili: {result.origin}</p>
          {Object.entries(result.results).map(([k, v]) => (
            <p key={k}>
              <b className="capitalize">{k} bot:</b> {!v.configured ? "sozlanmagan" : v.error ? <span className="text-danger">{v.error}</span> : <span className="text-success">@{v.username} — webhook, menyu tugmasi va buyruqlar sozlandi ✓</span>}
            </p>
          ))}
        </div>
      )}
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            setResult(await adminApi.post("/telegram/setup"));
            void qc.invalidateQueries({ queryKey: ["admin", "telegram"] });
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : "Sozlash bajarilmadi");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : <Icon name="telegram" size={18} />} Botlarni shu saytga ulash
      </button>
    </Section>
  );
}

function AdminsSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "admins"], queryFn: () => adminApi.get<{ rows: AdminRow[] }>("/admins").then((r) => r.rows) });
  const [f, setF] = useState({ username: "", password: "", role: "admin" });
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [linkIds, setLinkIds] = useState<Record<number, string>>({});
  return (
    <Section title="Admin akkauntlari" subtitle="Huquqlar: viewer = faqat ko'rish · admin = kontent · owner = sozlamalar va akkauntlar.">
      {msg && <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <ul className="mb-4 divide-y divide-white/[0.06] text-sm">
        {(q.data ?? []).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <span className="min-w-[120px] font-medium">{a.username}</span>
            <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-muted">{ROLE_UZ[a.role] ?? a.role}</span>
            <span className="flex-1 text-xs text-muted">{a.last_login_at ? `oxirgi kirish: ${new Date(a.last_login_at).toLocaleString()}` : "hali kirmagan"}</span>
            <Input
              className="h-9 min-h-0 w-40"
              placeholder="Telegram ID"
              value={linkIds[a.id] ?? (a.telegram_id ? String(a.telegram_id) : "")}
              onChange={(e) => setLinkIds({ ...linkIds, [a.id]: e.target.value })}
              aria-label={`${a.username} uchun Telegram ID`}
            />
            <button
              type="button"
              className="btn btn-secondary h-9 min-h-0 text-xs"
              onClick={async () => {
                try {
                  const v = (linkIds[a.id] ?? "").trim();
                  await adminApi.put(`/admins/${a.id}/telegram`, { telegramId: v ? Number(v) : null });
                  setMsg({ tone: "info", text: `${a.username} uchun Telegram bog'landi` });
                  void qc.invalidateQueries({ queryKey: ["admin", "admins"] });
                } catch (e) {
                  setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Xatolik" });
                }
              }}
            >
              Bog'lash
            </button>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await adminApi.post("/admins", f);
            setMsg({ tone: "info", text: `Admin ${f.username} yaratildi` });
            setF({ username: "", password: "", role: "admin" });
            void qc.invalidateQueries({ queryKey: ["admin", "admins"] });
          } catch (err) {
            setMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Xatolik" });
          }
        }}
      >
        <Input placeholder="login" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required />
        <Input type="password" placeholder="parol (kamida 10)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={10} autoComplete="new-password" />
        <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="viewer">Kuzatuvchi</option>
          <option value="admin">Admin</option>
          <option value="owner">Egasi</option>
        </Select>
        <button type="submit" className="btn btn-primary">Qo'shish</button>
      </form>
    </Section>
  );
}

export default function SettingsPage({ me }: { me: AdminMe }) {
  const qc = useQueryClient();
  const isOwner = me.role === "owner";
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminApi.get<{ settings: AppSettings }>("/settings").then((r) => r.settings) });
  const [s, setS] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  useEffect(() => {
    if (q.data) setS(q.data);
  }, [q.data]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.put<{ settings: AppSettings }>("/settings", s);
      setS(r.settings);
      qc.setQueryData(["admin", "settings"], r.settings);
      setMsg({ tone: "info", text: "Sozlamalar saqlandi." });
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Saqlashda xatolik" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Sozlamalar" subtitle={isOwner ? "Ilova sozlamalari." : "Sozlamalarni faqat egasi o'zgartira oladi."} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Ilova">
          {!s ? (
            <Spinner className="text-muted" />
          ) : (
            <form onSubmit={save} className="space-y-4">
              {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
              <fieldset disabled={!isOwner} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Ilova nomi"><Input value={s.app_name} onChange={(e) => setS({ ...s, app_name: e.target.value })} maxLength={40} /></Field>
                  <Field label="Minimal ilova versiyasi"><Input value={s.min_app_version} onChange={(e) => setS({ ...s, min_app_version: e.target.value })} pattern="\d+\.\d+\.\d+" /></Field>
                  <Field label="Kunlik mukofot (virtual tanga)"><Input type="number" min={0} value={s.daily_reward_amount} onChange={(e) => setS({ ...s, daily_reward_amount: Number(e.target.value) })} /></Field>
                  <Field label="Yangi o'yinchilar uchun boshlang'ich tanga"><Input type="number" min={0} value={s.starting_coins} onChange={(e) => setS({ ...s, starting_coins: Number(e.target.value) })} /></Field>
                  <Field label="Keys ochish oralig'i (soniya)"><Input type="number" min={0} max={3600} value={s.open_cooldown_seconds} onChange={(e) => setS({ ...s, open_cooldown_seconds: Number(e.target.value) })} /></Field>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div><p className="mb-1.5 text-xs font-medium text-muted">Texnik ishlar rejimi</p><Segmented value={s.maintenance_mode ? "on" : "off"} onChange={(v) => setS({ ...s, maintenance_mode: v === "on" })} options={[{ value: "off", label: "O'chiq" }, { value: "on", label: "Yoqiq" }]} /></div>
                  <div><p className="mb-1.5 text-xs font-medium text-muted">Keyslar holati</p><Segmented value={s.cases_enabled ? "on" : "off"} onChange={(v) => setS({ ...s, cases_enabled: v === "on" })} options={[{ value: "on", label: "Yoqilgan" }, { value: "off", label: "To'xtatilgan" }]} /></div>
                  <div><p className="mb-1.5 text-xs font-medium text-muted">Animatsiya darajasi</p><Segmented value={s.animation_intensity} onChange={(v) => setS({ ...s, animation_intensity: v })} options={[{ value: "low", label: "Past" }, { value: "normal", label: "O'rta" }, { value: "high", label: "Yuqori" }]} /></div>
                </div>
              </fieldset>
              {isOwner && <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Sozlamalarni saqlash"}</button>}
            </form>
          )}
        </Section>
        {isOwner && <TelegramSection />}
        {isOwner && <AdminsSection />}
        <Section title="Qoidalar">
          <p className="text-sm text-muted">
            SkinFlow — virtual ko'ngilochar ilova. Tangalar va skinlar pul qiymatiga ega emas. Sotib olish, depozit, pul yechish, savdo yoki virtual narsalarni haqiqiy qiymatga aylantirish funksiyasi ataylab yo'q — adminlar uchun ham.
          </p>
        </Section>
      </div>
    </>
  );
}

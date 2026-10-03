import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api";
import type { AdminMe } from "../AdminApp";
import { adminApi } from "../api";
import { Field, Input, Notice, PageHeader, Segmented, Select } from "../components/kit";

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
    <Section title="Telegram bots" subtitle="Player bot opens the game; admin bot opens this panel as a Mini App.">
      {q.data && (
        <ul className="mb-4 space-y-1.5 text-sm">
          <li className="flex items-center gap-2"><Icon name={q.data.appBotConfigured ? "check" : "close"} size={16} className={q.data.appBotConfigured ? "text-success" : "text-danger"} /> Player bot token {q.data.appBotConfigured ? "configured" : "missing (TELEGRAM_BOT_TOKEN)"}</li>
          <li className="flex items-center gap-2"><Icon name={q.data.adminBotConfigured ? "check" : "close"} size={16} className={q.data.adminBotConfigured ? "text-success" : "text-danger"} /> Admin bot token {q.data.adminBotConfigured ? "configured" : "missing (ADMIN_TELEGRAM_BOT_TOKEN)"}</li>
          <li className="text-xs text-muted">Allowed admin Telegram IDs (env): {q.data.allowedIds.length ? q.data.allowedIds.join(", ") : "none"} · Linked: {q.data.linked.map((l) => `${l.username} (${l.telegram_id})`).join(", ") || "none"}</li>
        </ul>
      )}
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
      {result && (
        <div className="mb-3 space-y-1 rounded-xl bg-surface2 p-3 text-xs">
          <p className="text-muted">Mini App URL: {result.origin}</p>
          {Object.entries(result.results).map(([k, v]) => (
            <p key={k}>
              <b className="capitalize">{k} bot:</b> {!v.configured ? "not configured" : v.error ? <span className="text-danger">{v.error}</span> : <span className="text-success">@{v.username} — webhook, menu button & commands set ✓</span>}
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
            setErr(e instanceof ApiError ? e.message : "Setup failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : <Icon name="telegram" size={18} />} Connect bots to this deployment
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
    <Section title="Admin accounts" subtitle="RBAC: viewer = read-only · admin = content · owner = settings & accounts.">
      {msg && <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <ul className="mb-4 divide-y divide-white/[0.06] text-sm">
        {(q.data ?? []).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <span className="min-w-[120px] font-medium">{a.username}</span>
            <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] capitalize text-muted">{a.role}</span>
            <span className="flex-1 text-xs text-muted">{a.last_login_at ? `last login ${new Date(a.last_login_at).toLocaleString()}` : "never logged in"}</span>
            <Input
              className="h-9 min-h-0 w-40"
              placeholder="Telegram ID"
              value={linkIds[a.id] ?? (a.telegram_id ? String(a.telegram_id) : "")}
              onChange={(e) => setLinkIds({ ...linkIds, [a.id]: e.target.value })}
              aria-label={`Telegram ID for ${a.username}`}
            />
            <button
              type="button"
              className="btn btn-secondary h-9 min-h-0 text-xs"
              onClick={async () => {
                try {
                  const v = (linkIds[a.id] ?? "").trim();
                  await adminApi.put(`/admins/${a.id}/telegram`, { telegramId: v ? Number(v) : null });
                  setMsg({ tone: "info", text: `Telegram link updated for ${a.username}` });
                  void qc.invalidateQueries({ queryKey: ["admin", "admins"] });
                } catch (e) {
                  setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Failed" });
                }
              }}
            >
              Link
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
            setMsg({ tone: "info", text: `Admin ${f.username} created` });
            setF({ username: "", password: "", role: "admin" });
            void qc.invalidateQueries({ queryKey: ["admin", "admins"] });
          } catch (err) {
            setMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Failed" });
          }
        }}
      >
        <Input placeholder="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required />
        <Input type="password" placeholder="password (min 10)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={10} autoComplete="new-password" />
        <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="viewer">viewer</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </Select>
        <button type="submit" className="btn btn-primary">Add</button>
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
      setMsg({ tone: "info", text: "Settings saved." });
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle={isOwner ? "Application-wide configuration." : "Only owners can change settings."} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Application">
          {!s ? (
            <Spinner className="text-muted" />
          ) : (
            <form onSubmit={save} className="space-y-4">
              {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
              <fieldset disabled={!isOwner} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Application name"><Input value={s.app_name} onChange={(e) => setS({ ...s, app_name: e.target.value })} maxLength={40} /></Field>
                  <Field label="Minimum app version"><Input value={s.min_app_version} onChange={(e) => setS({ ...s, min_app_version: e.target.value })} pattern="\d+\.\d+\.\d+" /></Field>
                  <Field label="Daily reward amount (virtual coins)"><Input type="number" min={0} value={s.daily_reward_amount} onChange={(e) => setS({ ...s, daily_reward_amount: Number(e.target.value) })} /></Field>
                  <Field label="Starting coins for new players"><Input type="number" min={0} value={s.starting_coins} onChange={(e) => setS({ ...s, starting_coins: Number(e.target.value) })} /></Field>
                  <Field label="Case opening cooldown (seconds)"><Input type="number" min={0} max={3600} value={s.open_cooldown_seconds} onChange={(e) => setS({ ...s, open_cooldown_seconds: Number(e.target.value) })} /></Field>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div><p className="mb-1.5 text-xs font-medium text-muted">Maintenance mode</p><Segmented value={s.maintenance_mode ? "on" : "off"} onChange={(v) => setS({ ...s, maintenance_mode: v === "on" })} options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]} /></div>
                  <div><p className="mb-1.5 text-xs font-medium text-muted">Case availability</p><Segmented value={s.cases_enabled ? "on" : "off"} onChange={(v) => setS({ ...s, cases_enabled: v === "on" })} options={[{ value: "on", label: "Enabled" }, { value: "off", label: "Paused" }]} /></div>
                  <div><p className="mb-1.5 text-xs font-medium text-muted">Animation intensity</p><Segmented value={s.animation_intensity} onChange={(v) => setS({ ...s, animation_intensity: v })} options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }]} /></div>
                </div>
              </fieldset>
              {isOwner && <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Save settings"}</button>}
            </form>
          )}
        </Section>
        {isOwner && <TelegramSection />}
        {isOwner && <AdminsSection />}
        <Section title="Compliance">
          <p className="text-sm text-muted">
            SkinFlow is a virtual entertainment app. Coins and skins have no monetary value. There is intentionally no functionality for purchases, deposits, withdrawals, cash-out, trading or converting
            virtual items into anything of real-world value — including for administrators.
          </p>
        </Section>
      </div>
    </>
  );
}

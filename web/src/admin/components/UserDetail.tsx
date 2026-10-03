import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Avatar, CoinIcon, Skeleton, Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { fmt, shortDate } from "../../lib/format";
import type { Rarity } from "../../lib/types";
import { adminApi, type AdminSkin } from "../api";
import { Field, Input, Notice, RarityPill, StatusPill } from "./kit";

interface Detail {
  user: Record<string, any>;
  inventory: { id: number; quantity: number; favorite: boolean; acquiredAt: string; skin: AdminSkin }[];
  openings: { id: number; created_at: string; cost: number; case_name: string; skin_name: string; weapon_name: string; rarity: Rarity }[];
  missions: { period_key: string; progress: number; completed_at: string | null; claimed_at: string | null; title: string; target: number; reward: number }[];
  rewards: { claim_date: string; amount: number }[];
}

export function UserDetail({ userId, canEdit }: { userId: number; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "user", userId], queryFn: () => adminApi.get<Detail>(`/users/${userId}`) });
  const [tab, setTab] = useState<"inventory" | "openings" | "missions" | "rewards">("inventory");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  if (q.isLoading) return <div className="space-y-3 pt-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if (q.isError || !q.data) return <Notice tone="error">Couldn't load this user.</Notice>;
  const { user, inventory, openings, missions, rewards } = q.data;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
    void qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const adjust = async () => {
    const d = Number(delta);
    if (!Number.isInteger(d) || d === 0) return setMsg({ tone: "error", text: "Enter a non-zero whole number (negative to remove)." });
    if (reason.trim().length < 3) return setMsg({ tone: "error", text: "A reason is required for the audit log." });
    setBusy(true);
    try {
      await adminApi.post(`/users/${userId}/coins`, { delta: d, reason: reason.trim() });
      setMsg({ tone: "info", text: "Virtual coin balance updated." });
      setDelta("");
      setReason("");
      refresh();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center gap-3">
        <Avatar src={user.avatar_url} name={user.first_name} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">{user.first_name} {user.username && <span className="text-sm font-normal text-muted">@{user.username}</span>}</p>
          <p className="text-xs text-muted">ID {user.id} · {user.telegram_id ? `Telegram ${user.telegram_id}` : "Guest"} · joined {shortDate(user.created_at)}</p>
        </div>
        <StatusPill active={!user.blocked} on="Active" off="Blocked" />
      </div>
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="rounded-xl bg-surface2 p-3"><p className="inline-flex items-center gap-1 font-display text-lg font-bold tabular-nums"><CoinIcon size={14} />{fmt(user.virtual_coins)}</p><p className="text-[11px] text-muted">Virtual coins</p></div>
        <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-lg font-bold">{user.level}</p><p className="text-[11px] text-muted">Level</p></div>
        <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-lg font-bold">{user.streak_days}</p><p className="text-[11px] text-muted">Streak</p></div>
      </div>

      {canEdit && (
        <div className="rounded-xl border hairline p-3">
          {msg && <div className="mb-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
          <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
            <Field label="Coins ±"><Input type="number" step={1} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+500" /></Field>
            <Field label="Reason (audit log)"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Support compensation" /></Field>
            <div className="flex items-end gap-2">
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={adjust}>{busy ? <Spinner /> : "Apply"}</button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  await adminApi.post(`/users/${userId}/block`, { blocked: !user.blocked });
                  refresh();
                }}
              >
                {user.blocked ? "Unblock" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b hairline">
        {(["inventory", "openings", "missions", "rewards"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`min-h-[40px] border-b-2 px-3 text-sm capitalize ${tab === t ? "border-accent text-fg" : "border-transparent text-muted"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="max-h-[40vh] overflow-y-auto">
        {tab === "inventory" && (
          <ul className="divide-y divide-white/[0.06]">
            {inventory.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                <img src={i.skin.thumbnail} alt="" className="h-8 w-12 object-contain" />
                <span className="min-w-0 flex-1 truncate">{i.skin.name} <span className="text-muted">· {i.skin.weaponName}</span></span>
                <RarityPill rarity={i.skin.rarity} />
                <span className="w-10 text-right tabular-nums">×{i.quantity}</span>
              </li>
            ))}
            {inventory.length === 0 && <li className="py-6 text-center text-xs text-muted">Empty inventory</li>}
          </ul>
        )}
        {tab === "openings" && (
          <ul className="divide-y divide-white/[0.06] text-sm">
            {openings.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate">{o.skin_name} <span className="text-muted">· {o.case_name}</span></span>
                <RarityPill rarity={o.rarity} />
                <span className="text-xs text-muted">{shortDate(o.created_at)}</span>
              </li>
            ))}
            {openings.length === 0 && <li className="py-6 text-center text-xs text-muted">No openings</li>}
          </ul>
        )}
        {tab === "missions" && (
          <ul className="divide-y divide-white/[0.06] text-sm">
            {missions.map((m, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate">{m.title} <span className="text-muted">· {m.period_key}</span></span>
                <span className="tabular-nums text-muted">{m.progress}/{m.target}</span>
                <span className={m.claimed_at ? "text-success" : m.completed_at ? "text-coin" : "text-muted"}>{m.claimed_at ? "claimed" : m.completed_at ? "ready" : "in progress"}</span>
              </li>
            ))}
            {missions.length === 0 && <li className="py-6 text-center text-xs text-muted">No mission activity</li>}
          </ul>
        )}
        {tab === "rewards" && (
          <ul className="divide-y divide-white/[0.06] text-sm">
            {rewards.map((r) => (
              <li key={r.claim_date} className="flex justify-between py-2"><span>{shortDate(r.claim_date)}</span><span className="inline-flex items-center gap-1 tabular-nums"><CoinIcon size={12} />{r.amount}</span></li>
            ))}
            {rewards.length === 0 && <li className="py-6 text-center text-xs text-muted">No daily rewards claimed</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

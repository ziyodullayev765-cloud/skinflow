import type { PoolClient } from "pg";
import { query, type Queryable, withTransaction } from "../db/pool.js";
import { ApiError } from "../lib/errors.js";
import { periodKey } from "../lib/time.js";

export type MissionType = "open_case" | "view_skins" | "claim_daily" | "complete_profile" | "login_streak";

interface MissionRow {
  id: number;
  code: string;
  title: string;
  description: string;
  type: MissionType;
  target: number;
  reward: number;
  period: "daily" | "weekly" | "once";
  sort_order: number;
}

/**
 * Advances progress for every active mission of `type`.
 * mode "add" increments; mode "set" sets an absolute value (e.g. streak length).
 */
export async function trackMission(client: Queryable, userId: number, type: MissionType, amount = 1, mode: "add" | "set" = "add"): Promise<void> {
  const missions = await query<MissionRow>(`SELECT * FROM missions WHERE active AND type = $1`, [type], client);
  for (const m of missions) {
    const key = periodKey(m.period);
    await query(
      `INSERT INTO user_missions (user_id, mission_id, period_key, progress, completed_at)
       VALUES ($1, $2, $3, LEAST($4::int, $5::int), CASE WHEN $4::int >= $5::int THEN now() END)
       ON CONFLICT (user_id, mission_id, period_key) DO UPDATE SET
         progress = LEAST(CASE WHEN $6 = 'set' THEN GREATEST(user_missions.progress, $4::int) ELSE user_missions.progress + $4::int END, $5::int),
         completed_at = COALESCE(user_missions.completed_at,
           CASE WHEN (CASE WHEN $6 = 'set' THEN GREATEST(user_missions.progress, $4::int) ELSE user_missions.progress + $4::int END) >= $5::int THEN now() END),
         updated_at = now()`,
      [userId, m.id, key, amount, m.target, mode],
      client,
    );
  }
}

export async function listMissions(userId: number) {
  const missions = await query<MissionRow>(`SELECT * FROM missions WHERE active ORDER BY sort_order, id`);
  const keys = [...new Set(missions.map((m) => periodKey(m.period)))];
  const progress = await query<{ mission_id: number; period_key: string; progress: number; completed_at: Date | null; claimed_at: Date | null }>(
    `SELECT mission_id, period_key, progress, completed_at, claimed_at FROM user_missions WHERE user_id = $1 AND period_key = ANY($2)`,
    [userId, keys],
  );
  return missions.map((m) => {
    const p = progress.find((x) => x.mission_id === m.id && x.period_key === periodKey(m.period));
    return {
      id: m.id,
      code: m.code,
      title: m.title,
      description: m.description,
      type: m.type,
      target: m.target,
      reward: m.reward,
      period: m.period,
      progress: p?.progress ?? 0,
      completed: !!p?.completed_at,
      claimed: !!p?.claimed_at,
    };
  });
}

export async function claimMission(userId: number, missionId: number) {
  return withTransaction(async (client: PoolClient) => {
    const m = (await query<MissionRow>(`SELECT * FROM missions WHERE id = $1 AND active`, [missionId], client))[0];
    if (!m) throw new ApiError("NOT_FOUND", "Mission not found");
    const key = periodKey(m.period);
    const um = (
      await query<{ id: number; completed_at: Date | null; claimed_at: Date | null }>(
        `SELECT id, completed_at, claimed_at FROM user_missions WHERE user_id = $1 AND mission_id = $2 AND period_key = $3 FOR UPDATE`,
        [userId, m.id, key],
        client,
      )
    )[0];
    if (!um || !um.completed_at) throw new ApiError("NOT_COMPLETED", "Complete the mission first");
    if (um.claimed_at) throw new ApiError("ALREADY_CLAIMED", "Reward already claimed");
    await query(`UPDATE user_missions SET claimed_at = now(), updated_at = now() WHERE id = $1`, [um.id], client);
    const user = (
      await query<{ virtual_coins: number }>(
        `UPDATE users SET virtual_coins = virtual_coins + $2, updated_at = now() WHERE id = $1 RETURNING virtual_coins`,
        [userId, m.reward],
        client,
      )
    )[0];
    return { reward: m.reward, balance: user.virtual_coins };
  });
}

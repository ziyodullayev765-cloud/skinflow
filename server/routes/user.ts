import { Router } from "express";
import { z } from "zod";
import { getPool, query, queryOne, withTransaction } from "../db/pool.js";
import { ApiError } from "../lib/errors.js";
import { rateLimit } from "../lib/rateLimit.js";
import { idParam } from "../lib/sanitize.js";
import { parse } from "../lib/validate.js";
import { blockDuringMaintenance, requireUser } from "../middleware/auth.js";
import { claimMission, listMissions, trackMission } from "../services/missions.js";
import { openCase } from "../services/opening.js";
import { RARITY_RANK, SKIN_COLUMNS, serializeSkin, type SkinRow } from "../services/serialize.js";
import { getSettings } from "../services/settings.js";
import { checkIn, getMe } from "../services/users.js";
import { utcDateKey } from "../lib/time.js";
import { probabilities } from "../lib/random.js";

export const userRouter = Router();
userRouter.use(requireUser, blockDuringMaintenance);

const userKey = (req: { user?: { id: number } }) => String(req.user?.id ?? "anon");

userRouter.get("/me", async (req, res) => {
  await checkIn(req.user!.id);
  res.json({ user: await getMe(req.user!.id) });
});

userRouter.patch("/me", async (req, res) => {
  const body = parse(z.object({ language: z.enum(["en", "ru", "uz"]) }), req.body);
  await query(`UPDATE users SET language = $2, updated_at = now() WHERE id = $1`, [req.user!.id, body.language]);
  res.json({ user: await getMe(req.user!.id) });
});

// ---------- Cases ----------
async function loadCases(onlyId?: number) {
  const cases = await query(
    `SELECT id, slug, name, description, image, accent, cost, featured FROM cases WHERE active ${onlyId ? "AND id = $1" : ""} ORDER BY sort_order, id`,
    onlyId ? [onlyId] : [],
  );
  if (cases.length === 0) return [];
  const items = await query<SkinRow & { case_id: number; weight: number }>(
    `SELECT ci.case_id, ci.weight, ${SKIN_COLUMNS} FROM case_items ci JOIN skins s ON s.id = ci.skin_id
      WHERE s.active AND ci.case_id = ANY($1) ORDER BY ci.case_id`,
    [cases.map((c) => c.id)],
  );
  return cases.map((c) => {
    const own = items.filter((i) => i.case_id === c.id);
    const probs = probabilities(own.map((i) => ({ item: i, weight: i.weight })));
    const rarityOdds: Record<string, number> = {};
    for (const p of probs) rarityOdds[p.item.rarity] = (rarityOdds[p.item.rarity] ?? 0) + p.probability;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      image: c.image,
      accent: c.accent,
      cost: c.cost,
      featured: c.featured,
      itemCount: own.length,
      rarities: Object.keys(rarityOdds).sort((a, b) => RARITY_RANK[a] - RARITY_RANK[b]),
      rarityOdds,
      items: probs
        .map((p) => ({ ...serializeSkin(p.item), probability: p.probability }))
        .sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.virtualPrice - a.virtualPrice),
    };
  });
}

userRouter.get("/cases", async (_req, res) => {
  const settings = await getSettings();
  res.json({ cases: await loadCases(), casesEnabled: settings.cases_enabled });
});

userRouter.get("/cases/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const [c] = await loadCases(id);
  if (!c) throw new ApiError("CASE_UNAVAILABLE", "This case is not available.");
  res.json({ case: c });
});

userRouter.post("/cases/:id/open", rateLimit("open", 40, 60, userKey), async (req, res) => {
  const id = parse(idParam, req.params.id);
  // Request body is intentionally ignored: the client cannot influence the result.
  res.json(await openCase(req.user!.id, id));
});

// ---------- Inventory ----------
function serializeInventory(r: SkinRow & { inv_id: number; quantity: number; favorite: boolean; acquired_at: Date; inv_updated_at: Date }) {
  return {
    id: r.inv_id,
    quantity: r.quantity,
    favorite: r.favorite,
    acquiredAt: r.acquired_at,
    updatedAt: r.inv_updated_at,
    skin: serializeSkin(r),
  };
}

userRouter.get("/inventory", async (req, res) => {
  const rows = await query(
    `SELECT i.id AS inv_id, i.quantity, i.favorite, i.acquired_at, i.updated_at AS inv_updated_at, ${SKIN_COLUMNS}
       FROM inventory i JOIN skins s ON s.id = i.skin_id
      WHERE i.user_id = $1 AND i.quantity > 0 ORDER BY i.updated_at DESC`,
    [req.user!.id],
  );
  res.json({ items: rows.map(serializeInventory) });
});

/** Detail by skin id. Counts as a "view" for missions. */
userRouter.get("/inventory/:skinId", async (req, res) => {
  const skinId = parse(idParam, req.params.skinId);
  const row = await queryOne(
    `SELECT i.id AS inv_id, i.quantity, i.favorite, i.acquired_at, i.updated_at AS inv_updated_at, ${SKIN_COLUMNS}
       FROM inventory i JOIN skins s ON s.id = i.skin_id
      WHERE i.user_id = $1 AND i.skin_id = $2 AND i.quantity > 0`,
    [req.user!.id, skinId],
  );
  if (!row) throw new ApiError("NOT_FOUND", "This skin is not in your collection.");
  await trackMission(getPool(), req.user!.id, "view_skins", 1);
  res.json({ item: serializeInventory(row) });
});

userRouter.post("/inventory/:skinId/favorite", async (req, res) => {
  const skinId = parse(idParam, req.params.skinId);
  const { favorite } = parse(z.object({ favorite: z.boolean() }), req.body);
  const result = await withTransaction(async (client) => {
    const row = (
      await query<{ favorite: boolean }>(
        `UPDATE inventory SET favorite = $3, updated_at = updated_at WHERE user_id = $1 AND skin_id = $2 AND quantity > 0 RETURNING favorite`,
        [req.user!.id, skinId, favorite],
        client,
      )
    )[0];
    if (!row) throw new ApiError("NOT_FOUND", "This skin is not in your collection.");
    if (favorite) await trackMission(client, req.user!.id, "complete_profile", 1, "set");
    return row;
  });
  res.json({ favorite: result.favorite });
});

// ---------- Collections ----------
userRouter.get("/collections", async (req, res) => {
  const rows = await query<SkinRow & { quantity: number | null }>(
    `SELECT ${SKIN_COLUMNS}, i.quantity FROM skins s
       LEFT JOIN inventory i ON i.skin_id = s.id AND i.user_id = $1
      WHERE s.active ORDER BY collection NULLS LAST, s.virtual_price`,
    [req.user!.id],
  );
  const map = new Map<string, { name: string; total: number; owned: number; skins: unknown[] }>();
  for (const r of rows) {
    const name = r.collection ?? "Uncategorized";
    const c = map.get(name) ?? { name, total: 0, owned: 0, skins: [] };
    c.total++;
    if ((r.quantity ?? 0) > 0) c.owned++;
    c.skins.push({ ...serializeSkin(r), owned: (r.quantity ?? 0) > 0, quantity: r.quantity ?? 0 });
    map.set(name, c);
  }
  res.json({ collections: [...map.values()] });
});

// ---------- History ----------
userRouter.get("/openings", async (req, res) => {
  const q = parse(
    z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), before: z.coerce.number().int().positive().optional() }),
    req.query,
  );
  const rows = await query(
    `SELECT o.id, o.created_at, o.cost, c.name AS case_name, c.id AS case_id, ${SKIN_COLUMNS}
       FROM openings o JOIN skins s ON s.id = o.skin_id JOIN cases c ON c.id = o.case_id
      WHERE o.user_id = $1 ${q.before ? "AND o.id < $3" : ""}
      ORDER BY o.id DESC LIMIT $2`,
    q.before ? [req.user!.id, q.limit, q.before] : [req.user!.id, q.limit],
  );
  res.json({
    openings: rows.map((r) => ({ id: r.id, createdAt: r.created_at, cost: r.cost, caseId: r.case_id, caseName: r.case_name, skin: serializeSkin(r) })),
    nextCursor: rows.length === q.limit ? rows[rows.length - 1].id : null,
  });
});

// ---------- Missions ----------
userRouter.get("/missions", async (req, res) => {
  res.json({ missions: await listMissions(req.user!.id) });
});

userRouter.post("/missions/:id/claim", rateLimit("claim", 30, 60, userKey), async (req, res) => {
  const id = parse(idParam, req.params.id);
  res.json(await claimMission(req.user!.id, id));
});

// ---------- Daily reward ----------
userRouter.post("/daily-reward", rateLimit("daily", 10, 60, userKey), async (req, res) => {
  const settings = await getSettings();
  const amount = settings.daily_reward_amount;
  const out = await withTransaction(async (client) => {
    const inserted = await query(
      `INSERT INTO daily_rewards (user_id, claim_date, amount) VALUES ($1, $2::date, $3) ON CONFLICT (user_id, claim_date) DO NOTHING RETURNING id`,
      [req.user!.id, utcDateKey(), amount],
      client,
    );
    if (inserted.length === 0) throw new ApiError("ALREADY_CLAIMED", "Daily reward already claimed today.");
    const u = (await query<{ virtual_coins: number }>(
      `UPDATE users SET virtual_coins = virtual_coins + $2, updated_at = now() WHERE id = $1 RETURNING virtual_coins`,
      [req.user!.id, amount],
      client,
    ))[0];
    await trackMission(client, req.user!.id, "claim_daily", 1);
    return { amount, balance: u.virtual_coins };
  });
  res.json(out);
});

// ---------- Profile ----------
userRouter.get("/profile", async (req, res) => {
  const userId = req.user!.id;
  const me = await getMe(userId);
  const [fav, best, collections, missionsDone, rarity] = await Promise.all([
    queryOne(
      `SELECT ${SKIN_COLUMNS} FROM inventory i JOIN skins s ON s.id = i.skin_id
        WHERE i.user_id = $1 AND i.favorite AND i.quantity > 0 ORDER BY s.virtual_price DESC LIMIT 1`,
      [userId],
    ),
    queryOne(
      `SELECT ${SKIN_COLUMNS} FROM inventory i JOIN skins s ON s.id = i.skin_id
        WHERE i.user_id = $1 AND i.quantity > 0 ORDER BY s.virtual_price DESC LIMIT 1`,
      [userId],
    ),
    query<{ collection: string; total: number; owned: number }>(
      `SELECT COALESCE(col.name, 'Uncategorized') AS collection, count(*)::int AS total, count(i.id) FILTER (WHERE i.quantity > 0)::int AS owned
         FROM skins s LEFT JOIN collections col ON col.id = s.collection_id
         LEFT JOIN inventory i ON i.skin_id = s.id AND i.user_id = $1
        WHERE s.active GROUP BY 1 ORDER BY 1`,
      [userId],
    ),
    queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM user_missions WHERE user_id = $1 AND claimed_at IS NOT NULL`, [userId]),
    query<{ rarity: string; n: number }>(
      `SELECT s.rarity, sum(i.quantity)::int AS n FROM inventory i JOIN skins s ON s.id = i.skin_id WHERE i.user_id = $1 GROUP BY s.rarity`,
      [userId],
    ),
  ]);
  const totalCatalog = collections.reduce((s, c) => s + c.total, 0);
  const ownedCatalog = collections.reduce((s, c) => s + c.owned, 0);
  const rarityCounts = Object.fromEntries(rarity.map((r) => [r.rarity, r.n]));
  const achievements = [
    { code: "first-drop", title: "First Drop", description: "Open your first case", unlocked: (me?.totalOpenings ?? 0) >= 1 },
    { code: "ten-openings", title: "Getting Started", description: "Open 10 cases", unlocked: (me?.totalOpenings ?? 0) >= 10 },
    { code: "fifty-openings", title: "Dedicated", description: "Open 50 cases", unlocked: (me?.totalOpenings ?? 0) >= 50 },
    { code: "first-epic", title: "Epic Find", description: "Collect an Epic skin", unlocked: (rarityCounts.epic ?? 0) > 0 },
    { code: "first-legendary", title: "Legend", description: "Collect a Legendary skin", unlocked: (rarityCounts.legendary ?? 0) > 0 },
    { code: "collector-15", title: "Collector", description: "Own 15 unique skins", unlocked: ownedCatalog >= 15 },
    { code: "full-collection", title: "Completionist", description: "Complete any collection", unlocked: collections.some((c) => c.total > 0 && c.owned === c.total) },
    { code: "streak-7", title: "Regular", description: "Reach a 7-day streak", unlocked: (me?.streakDays ?? 0) >= 7 },
  ];
  res.json({
    user: me,
    favoriteSkin: fav ? serializeSkin(fav) : best ? serializeSkin(best) : null,
    collectionCompletion: totalCatalog ? ownedCatalog / totalCatalog : 0,
    ownedCatalog,
    totalCatalog,
    collections,
    missionsCompleted: missionsDone?.n ?? 0,
    rarityCounts,
    achievements,
  });
});

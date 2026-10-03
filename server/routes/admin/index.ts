import express, { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getPool, query, queryOne, withTransaction, type Queryable } from "../../db/pool.js";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, processSkinImage } from "../../lib/images.js";
import { ApiError } from "../../lib/errors.js";
import { probabilities, weightedPick } from "../../lib/random.js";
import { idParam, imageRef, safeText } from "../../lib/sanitize.js";
import { parse } from "../../lib/validate.js";
import { hashPassword } from "../../lib/password.js";
import { auditLog, requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { RARITY_RANK, SKIN_COLUMNS, serializeSkin, type SkinRow } from "../../services/serialize.js";
import { getSettings, invalidateSettings } from "../../services/settings.js";
import { adminAuthRouter } from "./auth.js";
import { setupBots } from "../telegram.js";
import { config } from "../../config.js";

export const adminRouter = Router();
adminRouter.use(adminAuthRouter);
adminRouter.use(requireAdmin);

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional().default(""),
});

const paging = (p: { page: number; pageSize: number }) => ({ limit: p.pageSize, offset: (p.page - 1) * p.pageSize });

// ------------------------------------------------------------------ Dashboard
adminRouter.get("/dashboard", async (_req, res) => {
  const [totals, usersPerDay, openingsPerDay, topCases, topSkins, rarity] = await Promise.all([
    queryOne(`SELECT
        (SELECT count(*)::int FROM users) AS total_users,
        (SELECT count(*)::int FROM users WHERE last_seen_date >= (now() AT TIME ZONE 'UTC')::date - 6) AS active_users,
        (SELECT count(*)::int FROM users WHERE last_seen_date = (now() AT TIME ZONE 'UTC')::date) AS daily_active_users,
        (SELECT count(*)::int FROM users WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS new_users_today,
        (SELECT COALESCE(sum(virtual_coins),0)::bigint FROM users) AS total_coins,
        (SELECT count(*)::int FROM openings) AS total_openings,
        (SELECT count(*)::int FROM openings WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS openings_today,
        (SELECT COALESCE(sum(quantity),0)::int FROM inventory) AS skins_collected,
        (SELECT COALESCE(sum(quantity),0)::int FROM sales) AS skins_sold`),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day, count(u.id)::int AS value
             FROM generate_series((now() AT TIME ZONE 'UTC')::date - 13, (now() AT TIME ZONE 'UTC')::date, '1 day') d
             LEFT JOIN users u ON (u.created_at AT TIME ZONE 'UTC')::date = d
            GROUP BY d ORDER BY d`),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day, count(o.id)::int AS value
             FROM generate_series((now() AT TIME ZONE 'UTC')::date - 13, (now() AT TIME ZONE 'UTC')::date, '1 day') d
             LEFT JOIN openings o ON (o.created_at AT TIME ZONE 'UTC')::date = d
            GROUP BY d ORDER BY d`),
    query(`SELECT c.name AS label, count(o.id)::int AS value FROM cases c LEFT JOIN openings o ON o.case_id = c.id
            GROUP BY c.id ORDER BY value DESC, c.name LIMIT 6`),
    query(`SELECT s.name || ' · ' || s.weapon_name AS label, s.rarity, COALESCE(sum(i.quantity),0)::int AS value
             FROM skins s LEFT JOIN inventory i ON i.skin_id = s.id GROUP BY s.id ORDER BY value DESC, s.name LIMIT 8`),
    query(`SELECT s.rarity AS label, count(o.id)::int AS value FROM openings o JOIN skins s ON s.id = o.skin_id GROUP BY s.rarity`),
  ]);
  res.json({
    totals,
    usersPerDay,
    openingsPerDay,
    topCases,
    topSkins,
    rarity: rarity.sort((a, b) => RARITY_RANK[a.label] - RARITY_RANK[b.label]),
  });
});

// ------------------------------------------------------------------ Users
adminRouter.get("/users", async (req, res) => {
  const p = parse(pageQuery, req.query);
  const { limit, offset } = paging(p);
  const like = `%${p.q}%`;
  const where = p.q ? `WHERE (u.username ILIKE $3 OR u.first_name ILIKE $3 OR u.telegram_id::text = $4 OR u.id::text = $4)` : "";
  const params = p.q ? [limit, offset, like, p.q] : [limit, offset];
  const rows = await query(
    `SELECT u.id, u.telegram_id, u.username, u.first_name, u.avatar_url, u.virtual_coins, u.level, u.xp, u.is_guest, u.blocked,
            u.streak_days, u.last_seen_date, u.created_at,
            (SELECT count(*)::int FROM openings o WHERE o.user_id = u.id) AS openings,
            count(*) OVER()::int AS total_count
       FROM users u ${where} ORDER BY u.id DESC LIMIT $1 OFFSET $2`,
    params,
  );
  res.json({ rows: rows.map(({ total_count, ...r }) => r), total: rows[0]?.total_count ?? 0, page: p.page, pageSize: p.pageSize });
});

adminRouter.get("/users/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const user = await queryOne(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!user) throw new ApiError("NOT_FOUND", "User not found");
  const [inventory, openings, missions, rewards, sales] = await Promise.all([
    query(`SELECT i.id AS inv_id, i.quantity, i.favorite, i.acquired_at, ${SKIN_COLUMNS}
             FROM inventory i JOIN skins s ON s.id = i.skin_id WHERE i.user_id = $1 ORDER BY s.virtual_price DESC`, [id]),
    query(`SELECT o.id, o.created_at, o.cost, c.name AS case_name, s.name AS skin_name, s.weapon_name, s.rarity
             FROM openings o JOIN cases c ON c.id = o.case_id JOIN skins s ON s.id = o.skin_id
            WHERE o.user_id = $1 ORDER BY o.id DESC LIMIT 50`, [id]),
    query(`SELECT um.period_key, um.progress, um.completed_at, um.claimed_at, m.title, m.target, m.reward, m.period
             FROM user_missions um JOIN missions m ON m.id = um.mission_id WHERE um.user_id = $1 ORDER BY um.updated_at DESC LIMIT 50`, [id]),
    query(`SELECT claim_date, amount, created_at FROM daily_rewards WHERE user_id = $1 ORDER BY claim_date DESC LIMIT 30`, [id]),
    query(`SELECT sa.id, sa.quantity, sa.total, sa.created_at, s.name AS skin_name, s.weapon_name, s.rarity
             FROM sales sa JOIN skins s ON s.id = sa.skin_id WHERE sa.user_id = $1 ORDER BY sa.id DESC LIMIT 50`, [id]),
  ]);
  res.json({
    user,
    inventory: inventory.map((r) => ({ id: r.inv_id, quantity: r.quantity, favorite: r.favorite, acquiredAt: r.acquired_at, skin: serializeSkin(r) })),
    openings,
    missions,
    rewards,
    sales,
  });
});

adminRouter.post("/users/:id/coins", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const body = parse(z.object({ delta: z.number().int().min(-1_000_000).max(1_000_000).refine((v) => v !== 0), reason: safeText(3, 200) }), req.body);
  const row = await queryOne(
    `UPDATE users SET virtual_coins = GREATEST(0, virtual_coins + $2), updated_at = now() WHERE id = $1 RETURNING virtual_coins`,
    [id, body.delta],
  );
  if (!row) throw new ApiError("NOT_FOUND", "User not found");
  await auditLog(req, "user.coins_adjust", "user", id, body);
  res.json({ coins: row.virtual_coins });
});

adminRouter.post("/users/:id/block", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { blocked } = parse(z.object({ blocked: z.boolean() }), req.body);
  const row = await queryOne(`UPDATE users SET blocked = $2, updated_at = now() WHERE id = $1 RETURNING blocked`, [id, blocked]);
  if (!row) throw new ApiError("NOT_FOUND", "User not found");
  await auditLog(req, blocked ? "user.block" : "user.unblock", "user", id);
  res.json({ blocked: row.blocked });
});

// ------------------------------------------------------------------ Collections
adminRouter.get("/collections", async (_req, res) => {
  res.json({
    rows: await query(
      `SELECT col.id, col.name, col.created_at, count(s.id)::int AS skin_count
         FROM collections col LEFT JOIN skins s ON s.collection_id = col.id GROUP BY col.id ORDER BY col.name`,
    ),
  });
});

adminRouter.post("/collections", requireRole("admin"), async (req, res) => {
  const { name } = parse(z.object({ name: safeText(2, 60) }), req.body);
  const row = await queryOne(
    `INSERT INTO collections (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name, created_at`,
    [name],
  );
  await auditLog(req, "collection.create", "collection", row.id, { name });
  res.status(201).json({ collection: row });
});

// ------------------------------------------------------------------ Skins
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
const WEAPONS = ["rifle", "smg", "pistol", "sniper", "shotgun", "knife", "gloves"] as const;
const WEAPON_DEFAULT_NAME: Record<(typeof WEAPONS)[number], string> = {
  rifle: "Rifle", smg: "SMG", pistol: "Pistol", sniper: "Sniper", shotgun: "Shotgun", knife: "Knife", gloves: "Gloves",
};
export const MAX_VIRTUAL_PRICE = 1_000_000;

/**
 * Images are referenced by the id returned from POST /uploads — the client
 * cannot point a skin at an arbitrary URL.
 */
const skinBody = z
  .object({
    name: safeText(2, 60),
    weaponType: z.enum(WEAPONS),
    weaponName: safeText(0, 60).optional(),
    rarity: z.enum(RARITIES),
    virtualPrice: z.number({ invalid_type_error: "Virtual price must be a number" }).int("Virtual price must be a whole number").positive("Virtual price must be positive").max(MAX_VIRTUAL_PRICE, `Max ${MAX_VIRTUAL_PRICE.toLocaleString("en-US")} coins`),
    description: safeText(0, 500).default(""),
    collectionId: idParam.nullable().optional(),
    newCollection: safeText(2, 60).optional(),
    uploadId: z.string().regex(/^[a-f0-9]{20}$/).optional(),
    active: z.boolean().default(true),
    featured: z.boolean().default(false),
  })
  .strict();

type SkinBody = z.infer<typeof skinBody>;

async function resolveCollection(client: Queryable, b: SkinBody): Promise<number | null> {
  if (b.newCollection) {
    const r = await query<{ id: number }>(
      `INSERT INTO collections (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [b.newCollection],
      client,
    );
    return r[0].id;
  }
  if (b.collectionId) {
    const r = await query(`SELECT id FROM collections WHERE id = $1`, [b.collectionId], client);
    if (!r.length) throw new ApiError("VALIDATION", "Collection not found", [{ path: "collectionId", message: "Collection not found" }]);
    return b.collectionId;
  }
  return null;
}

async function resolveUpload(client: Queryable, uploadId: string) {
  const u = (await query<{ original_url: string; optimized_url: string; thumbnail_url: string }>(
    `SELECT original_url, optimized_url, thumbnail_url FROM uploads WHERE id = $1`,
    [uploadId],
    client,
  ))[0];
  if (!u) throw new ApiError("VALIDATION", "Uploaded image not found — please upload again", [{ path: "uploadId", message: "Image not found" }]);
  return u;
}

async function loadSkin(id: number, client: Queryable = getPool()) {
  const r = await query<SkinRow & { owners: number }>(
    `SELECT ${SKIN_COLUMNS}, (SELECT count(*)::int FROM inventory i WHERE i.skin_id = s.id) AS owners FROM skins s WHERE s.id = $1`,
    [id],
    client,
  );
  return r[0] ? { ...serializeSkin(r[0]), owners: r[0].owners } : null;
}

adminRouter.get("/skins", async (req, res) => {
  const p = parse(
    pageQuery.extend({
      rarity: z.enum(RARITIES).optional(),
      weaponType: z.enum(WEAPONS).optional(),
      collectionId: idParam.optional(),
      status: z.enum(["active", "inactive"]).optional(),
      all: z.coerce.boolean().optional(),
    }),
    req.query,
  );
  const conds: string[] = [];
  const params: unknown[] = [];
  if (p.q) {
    params.push(`%${p.q}%`);
    conds.push(`(s.name ILIKE $${params.length} OR s.weapon_name ILIKE $${params.length} OR EXISTS (SELECT 1 FROM collections c WHERE c.id = s.collection_id AND c.name ILIKE $${params.length}))`);
  }
  if (p.rarity) { params.push(p.rarity); conds.push(`s.rarity = $${params.length}`); }
  if (p.weaponType) { params.push(p.weaponType); conds.push(`s.weapon_type = $${params.length}`); }
  if (p.collectionId) { params.push(p.collectionId); conds.push(`s.collection_id = $${params.length}`); }
  if (p.status) conds.push(p.status === "active" ? "s.active" : "NOT s.active");
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = p.all ? 1000 : p.pageSize;
  const offset = p.all ? 0 : (p.page - 1) * p.pageSize;
  params.push(limit, offset);
  const rows = await query<SkinRow & { total_count: number; owners: number }>(
    `SELECT ${SKIN_COLUMNS}, (SELECT count(*)::int FROM inventory i WHERE i.skin_id = s.id) AS owners, count(*) OVER()::int AS total_count
       FROM skins s ${where} ORDER BY s.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ rows: rows.map((r) => ({ ...serializeSkin(r), owners: r.owners })), total: rows[0]?.total_count ?? 0, page: p.page, pageSize: p.pageSize });
});

/** Distinct weapon names with skin counts (for the bulk rename tool). */
adminRouter.get("/weapon-names", async (_req, res) => {
  res.json({
    rows: await query(`SELECT weapon_name AS name, weapon_type AS type, count(*)::int AS skins FROM skins GROUP BY weapon_name, weapon_type ORDER BY weapon_type, weapon_name`),
  });
});

/** Renames a weapon across every skin that uses it. */
adminRouter.put("/weapon-names", requireRole("admin"), async (req, res) => {
  const b = parse(z.object({ from: z.string().trim().min(1).max(60), to: safeText(1, 60) }), req.body);
  const rows = await query(`UPDATE skins SET weapon_name = $2, updated_at = now() WHERE weapon_name = $1 RETURNING id`, [b.from, b.to]);
  if (!rows.length) throw new ApiError("NOT_FOUND", "No skins use that weapon name");
  await auditLog(req, "weapon.rename", "weapon", undefined, { ...b, skins: rows.length });
  res.json({ updated: rows.length });
});

adminRouter.get("/skins/:id", async (req, res) => {
  const skin = await loadSkin(parse(idParam, req.params.id));
  if (!skin) throw new ApiError("NOT_FOUND", "Skin not found");
  res.json({ skin });
});

function skinSlug(name: string, weaponType: string) {
  const base = `${weaponType}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base}-${randomBytes(3).toString("hex")}`;
}

adminRouter.post("/skins", requireRole("admin"), async (req, res) => {
  const b = parse(skinBody, req.body);
  if (!b.uploadId) throw new ApiError("VALIDATION", "Image is required", [{ path: "uploadId", message: "Image is required" }]);
  const id = await withTransaction(async (client) => {
    const img = await resolveUpload(client, b.uploadId!);
    const collectionId = await resolveCollection(client, b);
    const r = await query<{ id: number }>(
      `INSERT INTO skins (slug, name, weapon_name, weapon_type, rarity, image_url, optimized_image_url, thumbnail_url, description, virtual_price, collection_id, active, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [skinSlug(b.name, b.weaponType), b.name, b.weaponName || WEAPON_DEFAULT_NAME[b.weaponType], b.weaponType, b.rarity, img.original_url, img.optimized_url, img.thumbnail_url, b.description, b.virtualPrice, collectionId, b.active, b.featured],
      client,
    );
    return r[0].id;
  });
  await auditLog(req, "skin.create", "skin", id, { name: b.name, rarity: b.rarity, virtualPrice: b.virtualPrice });
  res.status(201).json({ skin: await loadSkin(id) });
});

adminRouter.put("/skins/:id", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const b = parse(skinBody, req.body);
  await withTransaction(async (client) => {
    const existing = (await query(`SELECT id FROM skins WHERE id = $1 FOR UPDATE`, [id], client))[0];
    if (!existing) throw new ApiError("NOT_FOUND", "Skin not found");
    const collectionId = await resolveCollection(client, b);
    const img = b.uploadId ? await resolveUpload(client, b.uploadId) : null;
    await query(
      `UPDATE skins SET name=$2, weapon_name=$3, weapon_type=$4, rarity=$5, description=$6, virtual_price=$7, collection_id=$8, active=$9, featured=$10,
              image_url = COALESCE($11, image_url), optimized_image_url = COALESCE($12, optimized_image_url), thumbnail_url = COALESCE($13, thumbnail_url),
              updated_at = now()
        WHERE id = $1`,
      [id, b.name, b.weaponName || WEAPON_DEFAULT_NAME[b.weaponType], b.weaponType, b.rarity, b.description, b.virtualPrice, collectionId, b.active, b.featured,
        img?.original_url ?? null, img?.optimized_url ?? null, img?.thumbnail_url ?? null],
      client,
    );
  });
  await auditLog(req, "skin.update", "skin", id, { name: b.name, rarity: b.rarity, virtualPrice: b.virtualPrice, active: b.active, featured: b.featured, imageChanged: !!b.uploadId });
  res.json({ skin: await loadSkin(id) });
});

adminRouter.patch("/skins/:id/status", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { active } = parse(z.object({ active: z.boolean() }), req.body);
  const row = await queryOne(`UPDATE skins SET active = $2, updated_at = now() WHERE id = $1 RETURNING id`, [id, active]);
  if (!row) throw new ApiError("NOT_FOUND", "Skin not found");
  await auditLog(req, active ? "skin.activate" : "skin.deactivate", "skin", id);
  res.json({ skin: await loadSkin(id) });
});

adminRouter.post("/skins/:id/duplicate", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const src = await queryOne<SkinRow>(`SELECT * FROM skins WHERE id = $1`, [id]);
  if (!src) throw new ApiError("NOT_FOUND", "Skin not found");
  const name = `${src.name} (copy)`.slice(0, 60);
  const row = await queryOne<{ id: number }>(
    `INSERT INTO skins (slug, name, weapon_name, weapon_type, rarity, image_url, optimized_image_url, thumbnail_url, description, virtual_price, collection_id, active, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE,FALSE) RETURNING id`,
    [skinSlug(name, src.weapon_type), name, src.weapon_name, src.weapon_type, src.rarity, src.image_url, src.optimized_image_url, src.thumbnail_url, src.description, src.virtual_price, src.collection_id],
  );
  await auditLog(req, "skin.duplicate", "skin", row!.id, { from: id });
  res.status(201).json({ skin: await loadSkin(row!.id) });
});

/**
 * Hard delete is only allowed while no player owns or has opened the skin;
 * otherwise it must be deactivated so player inventories stay intact.
 */
adminRouter.delete("/skins/:id", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const refs = await queryOne<{ owners: number; openings: number }>(
    `SELECT (SELECT count(*)::int FROM inventory WHERE skin_id = $1 AND quantity > 0) AS owners,
            (SELECT count(*)::int FROM openings WHERE skin_id = $1) + (SELECT count(*)::int FROM sales WHERE skin_id = $1) AS openings`,
    [id],
  );
  if (refs && (refs.owners > 0 || refs.openings > 0)) {
    throw new ApiError("CONFLICT", `This skin is owned by ${refs.owners} player(s). Deactivate it instead of deleting.`);
  }
  const row = await queryOne(`DELETE FROM skins WHERE id = $1 RETURNING id, name`, [id]);
  if (!row) throw new ApiError("NOT_FOUND", "Skin not found");
  await auditLog(req, "skin.delete", "skin", id, { name: row.name });
  res.json({ ok: true });
});

// ------------------------------------------------------------------ Cases
const caseBody = z.object({
  name: safeText(2, 60),
  description: safeText(0, 300),
  image: imageRef,
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cost: z.number().int().min(0).max(1_000_000),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  active: z.boolean().default(true),
});

async function caseDetail(id: number) {
  const c = await queryOne(`SELECT * FROM cases WHERE id = $1`, [id]);
  if (!c) return null;
  const items = await query<SkinRow & { weight: number }>(
    `SELECT ci.weight, ${SKIN_COLUMNS} FROM case_items ci JOIN skins s ON s.id = ci.skin_id WHERE ci.case_id = $1`,
    [id],
  );
  const probs = probabilities(items.map((i) => ({ item: i, weight: i.weight })));
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    image: c.image,
    accent: c.accent,
    cost: c.cost,
    featured: c.featured,
    sortOrder: c.sort_order,
    active: c.active,
    createdAt: c.created_at,
    items: probs
      .map((p) => ({ skin: serializeSkin(p.item), weight: p.weight, probability: p.probability }))
      .sort((a, b) => RARITY_RANK[b.skin.rarity] - RARITY_RANK[a.skin.rarity]),
  };
}

adminRouter.get("/cases", async (_req, res) => {
  const rows = await query(
    `SELECT c.*, (SELECT count(*)::int FROM case_items ci WHERE ci.case_id = c.id) AS item_count,
            (SELECT count(*)::int FROM openings o WHERE o.case_id = c.id) AS openings
       FROM cases c ORDER BY c.sort_order, c.id`,
  );
  res.json({
    rows: rows.map((c) => ({
      id: c.id, slug: c.slug, name: c.name, description: c.description, image: c.image, accent: c.accent, cost: c.cost,
      featured: c.featured, sortOrder: c.sort_order, active: c.active, itemCount: c.item_count, openings: c.openings, createdAt: c.created_at,
    })),
  });
});

adminRouter.get("/cases/:id", async (req, res) => {
  const d = await caseDetail(parse(idParam, req.params.id));
  if (!d) throw new ApiError("NOT_FOUND", "Case not found");
  res.json({ case: d });
});

adminRouter.post("/cases", requireRole("admin"), async (req, res) => {
  const b = parse(caseBody, req.body);
  const slug = `${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${randomBytes(2).toString("hex")}`;
  const row = await queryOne(
    `INSERT INTO cases (slug, name, description, image, accent, cost, featured, sort_order, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [slug, b.name, b.description, b.image, b.accent, b.cost, b.featured, b.sortOrder, b.active],
  );
  await auditLog(req, "case.create", "case", row!.id, { name: b.name, cost: b.cost });
  res.status(201).json({ case: await caseDetail(row!.id) });
});

adminRouter.put("/cases/:id", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const b = parse(caseBody, req.body);
  const row = await queryOne(
    `UPDATE cases SET name=$2, description=$3, image=$4, accent=$5, cost=$6, featured=$7, sort_order=$8, active=$9, updated_at=now() WHERE id=$1 RETURNING id`,
    [id, b.name, b.description, b.image, b.accent, b.cost, b.featured, b.sortOrder, b.active],
  );
  if (!row) throw new ApiError("NOT_FOUND", "Case not found");
  await auditLog(req, "case.update", "case", id, { name: b.name, cost: b.cost, active: b.active });
  res.json({ case: await caseDetail(id) });
});

adminRouter.delete("/cases/:id", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const row = await queryOne(`UPDATE cases SET active = FALSE, updated_at = now() WHERE id = $1 RETURNING id`, [id]);
  if (!row) throw new ApiError("NOT_FOUND", "Case not found");
  await auditLog(req, "case.deactivate", "case", id);
  res.json({ ok: true });
});

/** Replaces the full item list with explicit, visible weights. */
adminRouter.put("/cases/:id/items", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { items } = parse(
    z.object({
      items: z
        .array(z.object({ skinId: idParam, weight: z.number().int().min(1).max(1_000_000) }))
        .max(200)
        .refine((a) => new Set(a.map((i) => i.skinId)).size === a.length, "Duplicate skins"),
    }),
    req.body,
  );
  await withTransaction(async (client) => {
    const c = await query(`SELECT id FROM cases WHERE id = $1 FOR UPDATE`, [id], client);
    if (!c.length) throw new ApiError("NOT_FOUND", "Case not found");
    if (items.length) {
      const found = await query(`SELECT id FROM skins WHERE id = ANY($1)`, [items.map((i) => i.skinId)], client);
      if (found.length !== items.length) throw new ApiError("VALIDATION", "One or more skins do not exist");
    }
    await query(`DELETE FROM case_items WHERE case_id = $1`, [id], client);
    for (const i of items) await query(`INSERT INTO case_items (case_id, skin_id, weight) VALUES ($1,$2,$3)`, [id, i.skinId, i.weight], client);
  });
  await auditLog(req, "case.items_update", "case", id, { items });
  res.json({ case: await caseDetail(id) });
});

/** Simulates N openings with the live weights. Read-only: no balances or inventories change. */
adminRouter.post("/cases/:id/preview", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { count } = parse(z.object({ count: z.number().int().min(1).max(10000).default(1000) }), req.body ?? {});
  const d = await caseDetail(id);
  if (!d) throw new ApiError("NOT_FOUND", "Case not found");
  const active = d.items.filter((i) => i.skin.active);
  if (!active.length) throw new ApiError("CASE_UNAVAILABLE", "Case has no active items");
  const counts = new Map<number, number>();
  for (let n = 0; n < count; n++) {
    const s = weightedPick(active.map((i) => ({ item: i.skin.id, weight: i.weight })));
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  res.json({
    count,
    results: active.map((i) => ({ skin: i.skin, expected: i.probability, observed: (counts.get(i.skin.id) ?? 0) / count, hits: counts.get(i.skin.id) ?? 0 })),
  });
});

// ------------------------------------------------------------------ Openings
adminRouter.get("/openings", async (req, res) => {
  const p = parse(pageQuery.extend({ userId: idParam.optional(), caseId: idParam.optional() }), req.query);
  const conds: string[] = [];
  const params: unknown[] = [];
  if (p.userId) { params.push(p.userId); conds.push(`o.user_id = $${params.length}`); }
  if (p.caseId) { params.push(p.caseId); conds.push(`o.case_id = $${params.length}`); }
  if (p.q) { params.push(`%${p.q}%`); conds.push(`(u.username ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR s.name ILIKE $${params.length})`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const { limit, offset } = paging(p);
  params.push(limit, offset);
  const rows = await query(
    `SELECT o.id, o.created_at, o.cost, o.user_id, u.username, u.first_name, c.name AS case_name, s.name AS skin_name, s.weapon_name, s.rarity, COALESCE(s.thumbnail_url, s.image_url) AS image,
            count(*) OVER()::int AS total_count
       FROM openings o JOIN users u ON u.id = o.user_id JOIN cases c ON c.id = o.case_id JOIN skins s ON s.id = o.skin_id
       ${where} ORDER BY o.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ rows: rows.map(({ total_count, ...r }) => r), total: rows[0]?.total_count ?? 0, page: p.page, pageSize: p.pageSize });
});

// ------------------------------------------------------------------ Missions
const missionBody = z.object({
  code: z.string().trim().regex(/^[a-z0-9-]{3,40}$/, "Use lowercase letters, digits and dashes"),
  title: safeText(2, 80),
  description: safeText(0, 300),
  type: z.enum(["open_case", "view_skins", "claim_daily", "complete_profile", "login_streak"]),
  target: z.number().int().min(1).max(1000),
  reward: z.number().int().min(0).max(100_000),
  period: z.enum(["daily", "weekly", "once"]),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  active: z.boolean().default(true),
});

const serializeMission = (m: any) => ({
  id: m.id, code: m.code, title: m.title, description: m.description, type: m.type, target: m.target, reward: m.reward,
  period: m.period, sortOrder: m.sort_order, active: m.active, completions: m.completions ?? 0, createdAt: m.created_at,
});

adminRouter.get("/missions", async (_req, res) => {
  const rows = await query(
    `SELECT m.*, (SELECT count(*)::int FROM user_missions um WHERE um.mission_id = m.id AND um.claimed_at IS NOT NULL) AS completions
       FROM missions m ORDER BY m.sort_order, m.id`,
  );
  res.json({ rows: rows.map(serializeMission) });
});

adminRouter.post("/missions", requireRole("admin"), async (req, res) => {
  const b = parse(missionBody, req.body);
  const exists = await queryOne(`SELECT 1 FROM missions WHERE code = $1`, [b.code]);
  if (exists) throw new ApiError("CONFLICT", "A mission with this code already exists");
  const row = await queryOne(
    `INSERT INTO missions (code, title, description, type, target, reward, period, sort_order, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [b.code, b.title, b.description, b.type, b.target, b.reward, b.period, b.sortOrder, b.active],
  );
  await auditLog(req, "mission.create", "mission", row.id, { code: b.code });
  res.status(201).json({ mission: serializeMission(row) });
});

adminRouter.put("/missions/:id", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const b = parse(missionBody, req.body);
  const dup = await queryOne(`SELECT 1 FROM missions WHERE code = $1 AND id <> $2`, [b.code, id]);
  if (dup) throw new ApiError("CONFLICT", "A mission with this code already exists");
  const row = await queryOne(
    `UPDATE missions SET code=$2, title=$3, description=$4, type=$5, target=$6, reward=$7, period=$8, sort_order=$9, active=$10, updated_at=now()
      WHERE id = $1 RETURNING *`,
    [id, b.code, b.title, b.description, b.type, b.target, b.reward, b.period, b.sortOrder, b.active],
  );
  if (!row) throw new ApiError("NOT_FOUND", "Mission not found");
  await auditLog(req, "mission.update", "mission", id, { code: b.code, active: b.active });
  res.json({ mission: serializeMission(row) });
});

adminRouter.delete("/missions/:id", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const row = await queryOne(`UPDATE missions SET active = FALSE, updated_at = now() WHERE id = $1 RETURNING id`, [id]);
  if (!row) throw new ApiError("NOT_FOUND", "Mission not found");
  await auditLog(req, "mission.deactivate", "mission", id);
  res.json({ ok: true });
});

// ------------------------------------------------------------------ Promo codes
const promoBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "3–32 letters, digits, - or _"),
  reward: z.number().int().positive().max(1_000_000),
  maxUses: z.number().int().positive().max(10_000_000).nullable().default(null),
  expiresAt: z.string().datetime({ offset: true }).nullable().default(null),
  active: z.boolean().default(true),
  note: safeText(0, 200).default(""),
});

const serializePromo = (p: any) => ({
  id: p.id, code: p.code, reward: p.reward, maxUses: p.max_uses, uses: p.uses, expiresAt: p.expires_at, active: p.active, note: p.note, createdAt: p.created_at,
});

adminRouter.get("/promo-codes", async (_req, res) => {
  res.json({ rows: (await query(`SELECT * FROM promo_codes ORDER BY id DESC`)).map(serializePromo) });
});

adminRouter.post("/promo-codes", requireRole("admin"), async (req, res) => {
  const b = parse(promoBody, req.body);
  if (await queryOne(`SELECT 1 FROM promo_codes WHERE code = $1`, [b.code])) throw new ApiError("CONFLICT", "This code already exists");
  const row = await queryOne(
    `INSERT INTO promo_codes (code, reward, max_uses, expires_at, active, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.code, b.reward, b.maxUses, b.expiresAt, b.active, b.note],
  );
  await auditLog(req, "promo.create", "promo", row.id, { code: b.code, reward: b.reward, maxUses: b.maxUses });
  res.status(201).json({ promo: serializePromo(row) });
});

adminRouter.put("/promo-codes/:id", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const b = parse(promoBody, req.body);
  if (await queryOne(`SELECT 1 FROM promo_codes WHERE code = $1 AND id <> $2`, [b.code, id])) throw new ApiError("CONFLICT", "This code already exists");
  const row = await queryOne(
    `UPDATE promo_codes SET code=$2, reward=$3, max_uses=$4, expires_at=$5, active=$6, note=$7 WHERE id=$1 RETURNING *`,
    [id, b.code, b.reward, b.maxUses, b.expiresAt, b.active, b.note],
  );
  if (!row) throw new ApiError("NOT_FOUND", "Promo code not found");
  await auditLog(req, "promo.update", "promo", id, { code: b.code, reward: b.reward, active: b.active });
  res.json({ promo: serializePromo(row) });
});

adminRouter.delete("/promo-codes/:id", requireRole("admin"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const row = await queryOne(`DELETE FROM promo_codes WHERE id = $1 RETURNING code`, [id]);
  if (!row) throw new ApiError("NOT_FOUND", "Promo code not found");
  await auditLog(req, "promo.delete", "promo", id, { code: row.code });
  res.json({ ok: true });
});

// ------------------------------------------------------------------ Daily rewards
adminRouter.get("/rewards", async (req, res) => {
  const p = parse(pageQuery, req.query);
  const { limit, offset } = paging(p);
  const [rows, summary] = await Promise.all([
    query(
      `SELECT d.id, d.claim_date, d.amount, d.created_at, d.user_id, u.username, u.first_name, count(*) OVER()::int AS total_count
         FROM daily_rewards d JOIN users u ON u.id = d.user_id ORDER BY d.id DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    queryOne(`SELECT
        (SELECT count(*)::int FROM daily_rewards WHERE claim_date = (now() AT TIME ZONE 'UTC')::date) AS claims_today,
        (SELECT count(*)::int FROM daily_rewards) AS claims_total,
        (SELECT COALESCE(sum(amount),0)::bigint FROM daily_rewards) AS coins_total`),
  ]);
  const settings = await getSettings(undefined, true);
  res.json({
    rows: rows.map(({ total_count, ...r }) => r),
    total: rows[0]?.total_count ?? 0,
    page: p.page,
    pageSize: p.pageSize,
    summary: { ...summary, dailyRewardAmount: settings.daily_reward_amount },
  });
});

// ------------------------------------------------------------------ Settings
const settingsBody = z.object({
  app_name: safeText(2, 40),
  maintenance_mode: z.boolean(),
  animation_intensity: z.enum(["low", "normal", "high"]),
  daily_reward_amount: z.number().int().min(0).max(100_000),
  cases_enabled: z.boolean(),
  min_app_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  starting_coins: z.number().int().min(0).max(1_000_000),
  open_cooldown_seconds: z.number().int().min(0).max(3600),
});

adminRouter.get("/settings", async (_req, res) => {
  res.json({ settings: await getSettings(undefined, true) });
});

adminRouter.put("/settings", requireRole("owner"), async (req, res) => {
  const b = parse(settingsBody, req.body);
  await withTransaction(async (client) => {
    for (const [k, v] of Object.entries(b)) {
      await query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [k, JSON.stringify(v)],
        client,
      );
    }
  });
  invalidateSettings();
  await auditLog(req, "settings.update", "settings", undefined, b);
  res.json({ settings: await getSettings(undefined, true) });
});

// ------------------------------------------------------------------ Admin users (owner only)
adminRouter.get("/admins", requireRole("owner"), async (_req, res) => {
  res.json({ rows: await query(`SELECT id, username, email, telegram_id, role, active, last_login_at, created_at FROM admin_users ORDER BY id`) });
});

adminRouter.post("/admins", requireRole("owner"), async (req, res) => {
  const b = parse(
    z.object({
      username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,40}$/),
      email: z.string().trim().toLowerCase().email().max(120).optional(),
      password: z.string().min(10).max(200),
      role: z.enum(["owner", "admin", "viewer"]),
    }),
    req.body,
  );
  const exists = await queryOne(`SELECT 1 FROM admin_users WHERE username = $1 OR (email IS NOT NULL AND email = $2)`, [b.username, b.email ?? null]);
  if (exists) throw new ApiError("CONFLICT", "Admin already exists");
  const row = await queryOne(
    `INSERT INTO admin_users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, username, email, role, active, created_at`,
    [b.username, b.email ?? null, await hashPassword(b.password), b.role],
  );
  await auditLog(req, "admin.create", "admin", row.id, { username: b.username, role: b.role });
  res.status(201).json({ admin: row });
});

// ------------------------------------------------------------------ Telegram bots (owner only)
adminRouter.get("/telegram", requireRole("owner"), async (_req, res) => {
  const linked = await query(`SELECT id, username, telegram_id FROM admin_users WHERE telegram_id IS NOT NULL ORDER BY id`);
  res.json({
    appBotConfigured: !!config.telegramBotToken,
    adminBotConfigured: !!config.adminTelegramBotToken,
    allowedIds: config.adminTelegramIds,
    linked,
  });
});

adminRouter.post("/telegram/setup", requireRole("owner"), async (req, res) => {
  const origin = config.publicUrl || `https://${req.get("x-forwarded-host") || req.get("host")}`;
  const results = await setupBots(origin);
  const appBot = results.app as { username?: string } | undefined;
  if (appBot?.username) {
    await query(`INSERT INTO settings (key, value) VALUES ('telegram_bot_username', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(appBot.username)]);
    invalidateSettings();
  }
  await auditLog(req, "telegram.setup", "telegram", undefined, { origin });
  res.json({ origin, results });
});

adminRouter.put("/admins/:id/telegram", requireRole("owner"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { telegramId } = parse(z.object({ telegramId: z.coerce.number().int().positive().nullable() }), req.body);
  const dup = telegramId ? await queryOne(`SELECT 1 FROM admin_users WHERE telegram_id = $1 AND id <> $2`, [telegramId, id]) : null;
  if (dup) throw new ApiError("CONFLICT", "That Telegram account is already linked to another admin");
  const row = await queryOne(`UPDATE admin_users SET telegram_id = $2 WHERE id = $1 RETURNING id, username, telegram_id`, [id, telegramId]);
  if (!row) throw new ApiError("NOT_FOUND", "Admin not found");
  await auditLog(req, "admin.telegram_link", "admin", id, { telegramId });
  res.json({ admin: row });
});

// ------------------------------------------------------------------ Logs
adminRouter.get("/logs", async (req, res) => {
  const p = parse(pageQuery, req.query);
  const { limit, offset } = paging(p);
  const params: unknown[] = [limit, offset];
  let where = "";
  if (p.q) {
    params.push(`%${p.q}%`);
    where = `WHERE l.action ILIKE $3 OR l.entity ILIKE $3 OR a.username ILIKE $3`;
  }
  const rows = await query(
    `SELECT l.id, l.action, l.entity, l.entity_id, l.details, l.ip, l.created_at, a.username, count(*) OVER()::int AS total_count
       FROM admin_logs l LEFT JOIN admin_users a ON a.id = l.admin_id ${where} ORDER BY l.id DESC LIMIT $1 OFFSET $2`,
    params,
  );
  res.json({ rows: rows.map(({ total_count, ...r }) => r), total: rows[0]?.total_count ?? 0, page: p.page, pageSize: p.pageSize });
});

// ------------------------------------------------------------------ Uploads
// Raw binary body (Content-Type: image/png|jpeg|webp). Optimised + stored in object storage.
adminRouter.post(
  "/uploads",
  requireRole("admin"),
  express.raw({ type: [...ALLOWED_MIME], limit: MAX_UPLOAD_BYTES }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw new ApiError("VALIDATION", "Send the image as PNG, JPG or WEBP");
    const img = await processSkinImage(req.body, String(req.headers["content-type"] || "").split(";")[0]);
    await query(
      `INSERT INTO uploads (id, original_url, optimized_url, thumbnail_url, mime, size, width, height, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [img.id, img.originalUrl, img.optimizedUrl, img.thumbnailUrl, img.mime, img.size, img.width, img.height, req.admin!.id],
    );
    await auditLog(req, "upload.create", "upload", img.id, { mime: img.mime, size: img.size, width: img.width, height: img.height });
    res.status(201).json({ upload: img });
  },
);

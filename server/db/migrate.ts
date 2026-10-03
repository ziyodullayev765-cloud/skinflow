import { config } from "../config.js";
import { hashPassword } from "../lib/password.js";
import { getPool, query, queryOne, withTransaction } from "./pool.js";
import { schemaSql } from "./schema.js";
import { CATALOG, DEFAULT_MISSIONS, DEFAULT_SETTINGS, LEGACY_WEAPON_NAMES, RARITY_BASE_WEIGHT, WEAPON_MODELS, slugify } from "./catalog.js";

async function seedCatalog(): Promise<void> {
  const existing = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM skins");
  if (existing && existing.n > 0) return;

  await withTransaction(async (client) => {
    let order = 0;
    for (const col of CATALOG) {
      const c = await client.query<{ id: number }>(
        `INSERT INTO cases (slug, name, description, image, accent, cost, featured, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [col.caseSlug, col.caseName, col.caseDescription, `/assets/cases/${col.caseSlug}.svg`, col.accent, col.cost, !!col.featured, order++],
      );
      const caseId = c.rows[0].id;
      const perRarity = new Map<string, number>();
      for (const s of col.skins) perRarity.set(s.rarity, (perRarity.get(s.rarity) ?? 0) + 1);

      const colRow = await client.query<{ id: number }>(
        `INSERT INTO collections (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [col.collection],
      );
      for (const s of col.skins) {
        const slug = slugify(`${s.weapon}-${s.name}`);
        const img = `/assets/skins/${slug}.svg`;
        const sk = await client.query<{ id: number }>(
          `INSERT INTO skins (slug, name, weapon_name, weapon_type, rarity, image_url, optimized_image_url, thumbnail_url, description, virtual_price, collection_id, featured)
           VALUES ($1,$2,$3,$4,$5,$6,$6,$6,$7,$8,$9,$10)
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [slug, s.name, WEAPON_MODELS[s.model].name, s.weapon, s.rarity, img, s.description, s.value, colRow.rows[0].id, s.rarity === "legendary"],
        );
        const weight = Math.max(1, Math.round(RARITY_BASE_WEIGHT[s.rarity] / (perRarity.get(s.rarity) ?? 1)));
        await client.query(
          `INSERT INTO case_items (case_id, skin_id, weight) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [caseId, sk.rows[0].id, weight],
        );
      }
    }
  });
}

/** Renames seeded skins from the first release's placeholder weapon names to CS2 models (admin edits are kept). */
async function syncCatalogWeaponNames(): Promise<void> {
  for (const col of CATALOG) {
    for (const s of col.skins) {
      await query(`UPDATE skins SET weapon_name = $2, updated_at = now() WHERE slug = $1 AND weapon_name = ANY($3)`, [
        slugify(`${s.weapon}-${s.name}`),
        WEAPON_MODELS[s.model].name,
        LEGACY_WEAPON_NAMES,
      ]);
    }
  }
}

async function seedMissions(): Promise<void> {
  const existing = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM missions");
  if (existing && existing.n > 0) return;
  for (const m of DEFAULT_MISSIONS) {
    await query(
      `INSERT INTO missions (code, title, description, type, target, reward, period, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (code) DO NOTHING`,
      [m.code, m.title, m.description, m.type, m.target, m.reward, m.period, m.sort_order],
    );
  }
}

async function seedSettings(): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await query(`INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`, [
      key,
      JSON.stringify(value),
    ]);
  }
}

async function seedAdmin(): Promise<void> {
  const existing = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM admin_users");
  if (existing && existing.n > 0) return;
  if (!config.adminUsername || !config.adminPassword) {
    console.warn("[db] No admin users exist and ADMIN_USERNAME/ADMIN_PASSWORD are not set — admin panel is locked.");
    return;
  }
  if (config.adminPassword.length < 8) {
    console.warn("[db] ADMIN_PASSWORD must be at least 8 characters — initial admin not created.");
    return;
  }
  await query(`INSERT INTO admin_users (username, password_hash, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`, [
    config.adminUsername.toLowerCase(),
    await hashPassword(config.adminPassword),
  ]);
}

let migrationPromise: Promise<void> | null = null;

/** Test helper: forces the next ensureDatabase() call to re-run. */
export function resetMigrationState(): void {
  migrationPromise = null;
}

/** Creates schema + seed data once per process (memoised, safe for serverless cold starts). */
export function ensureDatabase(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      // Advisory lock so concurrent cold starts don't race on DDL.
      const client = await getPool().connect();
      try {
        await client.query("SELECT pg_advisory_lock(727274)");
        await client.query(schemaSql);
      } finally {
        await client.query("SELECT pg_advisory_unlock(727274)").catch(() => undefined);
        client.release();
      }
      await seedSettings();
      await seedCatalog();
      await syncCatalogWeaponNames();
      await seedMissions();
      await seedAdmin();
    })().catch((err) => {
      migrationPromise = null;
      throw err;
    });
  }
  return migrationPromise;
}

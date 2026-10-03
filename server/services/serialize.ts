export interface SkinRow {
  id: number;
  slug: string;
  name: string;
  weapon_name: string;
  weapon_type: string;
  rarity: string;
  image_url: string;
  optimized_image_url: string | null;
  thumbnail_url: string | null;
  description: string;
  virtual_price: number;
  collection_id: number | null;
  collection: string | null;
  active: boolean;
  featured: boolean;
  created_at: Date;
  updated_at?: Date;
}

/** Use with `FROM skins s`. Collection name is resolved inline so no extra JOIN is needed. */
export const SKIN_COLUMNS = `s.id, s.slug, s.name, s.weapon_name, s.weapon_type, s.rarity, s.image_url, s.optimized_image_url, s.thumbnail_url,
  s.description, s.virtual_price, s.collection_id, (SELECT col.name FROM collections col WHERE col.id = s.collection_id) AS collection,
  s.active, s.featured, s.created_at, s.updated_at`;

export function serializeSkin(s: SkinRow) {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    weaponName: s.weapon_name,
    weaponType: s.weapon_type,
    rarity: s.rarity,
    // The app always renders the optimized asset; the original is kept for admins.
    image: s.optimized_image_url || s.image_url,
    thumbnail: s.thumbnail_url || s.optimized_image_url || s.image_url,
    imageUrl: s.image_url,
    optimizedImageUrl: s.optimized_image_url,
    thumbnailUrl: s.thumbnail_url,
    description: s.description,
    virtualPrice: s.virtual_price,
    collectionId: s.collection_id,
    collection: s.collection ?? "Uncategorized",
    active: s.active,
    featured: s.featured,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

export const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

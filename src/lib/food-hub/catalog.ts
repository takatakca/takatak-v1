// Brands and locations (Atlas "Brands" + "Locations"). Seeded from your real data
// (data/actual), plus anything added in Food Hub → Business setup. Stored in fh_kv.
import rawBrands from './seed/brands.json';
import rawLocations from './seed/locations.json';
import { getRepo } from './repo';

export interface LocationDef {
  code: string;
  name: string;
  address: string;
  city?: string;
  postalCode?: string;
  active: boolean;
  seed?: boolean;
}

export interface BrandDef {
  name: string;
  active: boolean;
  seed?: boolean;
}

export interface Catalog {
  locations: LocationDef[];
  brands: BrandDef[];
}

const KEY = 'catalog';
/** Too Good To Go is a sales channel, not one of your brands. */
const NOT_BRANDS = new Set(['Too Good To Go']);

export function seedCatalog(): Catalog {
  return {
    locations: (rawLocations as Array<{ code: string; name: string; address_line_1: string; city?: string; postal_code?: string }>).map((l) => ({
      code: l.code, name: l.name, address: l.address_line_1, city: l.city, postalCode: l.postal_code, active: true, seed: true,
    })),
    brands: (rawBrands as string[]).filter((b) => !NOT_BRANDS.has(b)).map((name) => ({ name, active: true, seed: true })),
  };
}

export async function getCatalog(): Promise<Catalog> {
  const seed = seedCatalog();
  const stored = (await getRepo().getKv<Partial<Catalog>>(KEY).catch(() => null)) ?? {};
  const locations = new Map(seed.locations.map((l) => [l.code, l]));
  for (const l of stored.locations ?? []) locations.set(l.code, { ...locations.get(l.code), ...l });
  const brands = new Map(seed.brands.map((b) => [b.name, b]));
  for (const b of stored.brands ?? []) brands.set(b.name, { ...brands.get(b.name), ...b });
  return {
    locations: [...locations.values()],
    brands: [...brands.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  };
}

export async function activeLocations(): Promise<LocationDef[]> {
  return (await getCatalog()).locations.filter((l) => l.active);
}

export async function saveLocation(def: LocationDef): Promise<Catalog> {
  if (!/^[A-Z0-9_]{2,30}$/.test(def.code)) throw new Error('Location code: 2–30 capital letters, digits or _ (e.g. LAVAL).');
  if (!def.name?.trim()) throw new Error('Location name is required.');
  const stored = (await getRepo().getKv<Partial<Catalog>>(KEY)) ?? {};
  const list = (stored.locations ?? []).filter((l) => l.code !== def.code);
  list.push({ code: def.code, name: def.name.trim(), address: (def.address || '').trim(), city: def.city?.trim(), postalCode: def.postalCode?.trim(), active: def.active !== false });
  await getRepo().setKv(KEY, { ...stored, locations: list });
  return getCatalog();
}

export async function saveBrand(def: BrandDef): Promise<Catalog> {
  const name = def.name?.trim();
  if (!name) throw new Error('Brand name is required.');
  if (NOT_BRANDS.has(name)) throw new Error(`${name} is a sales channel, not a brand.`);
  const stored = (await getRepo().getKv<Partial<Catalog>>(KEY)) ?? {};
  const list = (stored.brands ?? []).filter((b) => b.name !== name);
  list.push({ name, active: def.active !== false });
  await getRepo().setKv(KEY, { ...stored, brands: list });
  return getCatalog();
}

export function locationLabel(catalog: Catalog, code?: string | null): string {
  if (!code) return 'unmapped store';
  return catalog.locations.find((l) => l.code === code)?.name ?? code;
}

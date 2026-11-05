/** Tenant-scoped text-draft library over existing SavedAiOutput records. */
export const STUDIO_LIBRARY_PAGE_SIZE = 20;
export const STUDIO_LIBRARY_MAX_OFFSET = 100000;
export type StudioLibraryTrack = "video" | "book" | "music" | "social";
export interface StudioLibraryFilter {
  offset: number;
  query: string;
  track: StudioLibraryTrack | null;
  projectId: string | null;
}
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function isTrack(value: unknown): value is StudioLibraryTrack {
  return typeof value === "string" && ["video", "book", "music", "social"].includes(value);
}
export function parseStudioLibraryFilter(params: URLSearchParams): StudioLibraryFilter | null {
  if (["offset", "q", "track", "projectId"].some(key => params.getAll(key).length > 1)) return null;
  const offsetText = params.get("offset") ?? "0";
  if (!/^(0|[1-9]\d{0,5})$/.test(offsetText)) return null;
  const offset = Number(offsetText);
  const query = params.get("q") ?? "";
  const track = params.get("track");
  const projectId = params.get("projectId");
  if (offset > STUDIO_LIBRARY_MAX_OFFSET || query.length > 100 || /[\u0000-\u001f\u007f]/.test(query) ||
      (track !== null && !isTrack(track)) || (projectId !== null && !UUID.test(projectId))) return null;
  return { offset, query: query.trim(), track: track as StudioLibraryTrack | null, projectId };
}
type MetadataFilter = { metadata: { path: string[]; equals: string } };
type SearchFilter = { OR: ({ title: { contains: string; mode: "insensitive" } } | { content: { contains: string; mode: "insensitive" } })[] };
export interface StudioLibraryQuery {
  where: { clientId: string; status: { not: "archived" }; AND: (MetadataFilter | SearchFilter)[] };
  select: { id: true; title: true; content: true; status: true; metadata: true; createdAt: true };
  orderBy: [{ createdAt: "desc" }, { id: "desc" }];
  take: number;
  skip: number;
}
/** clientId and source come from server authority; query parameters never choose either. */
export function studioLibraryQuery(clientId: string, filter: StudioLibraryFilter, source: string): StudioLibraryQuery {
  const conditions: StudioLibraryQuery["where"]["AND"] = [{ metadata: { path: ["source"], equals: source } }];
  if (filter.track) conditions.push({ metadata: { path: ["track"], equals: filter.track } });
  if (filter.projectId) conditions.push({ metadata: { path: ["projectId"], equals: filter.projectId } });
  if (filter.query) conditions.push({ OR: [{ title: { contains: filter.query, mode: "insensitive" } }, { content: { contains: filter.query, mode: "insensitive" } }] });
  return { where: { clientId, status: { not: "archived" }, AND: conditions },
    select: { id: true, title: true, content: true, status: true, metadata: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: STUDIO_LIBRARY_PAGE_SIZE + 1, skip: filter.offset };
}
export interface StudioLibraryRow {
  id: string;
  title: string;
  content: string;
  status: string;
  metadata: unknown;
  createdAt: Date;
}
function boundedMetadataText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
/** Do not expose arbitrary stored metadata, provider responses, secrets or internal actors. */
export function studioLibraryMetadata(value: unknown, source: string) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const safe: { source: string; projectId?: string; track?: StudioLibraryTrack; engine?: string; mode?: string; trial?: boolean;
    requestId?: string; originSource?: string; generatedBy?: string; knowledge?: string; version?: number } = { source };
  if (typeof raw.projectId === "string" && UUID.test(raw.projectId)) safe.projectId = raw.projectId;
  if (isTrack(raw.track)) safe.track = raw.track;
  if (boundedMetadataText(raw.engine, 80)) safe.engine = raw.engine;
  if (boundedMetadataText(raw.mode, 40)) safe.mode = raw.mode;
  if (typeof raw.trial === "boolean") safe.trial = raw.trial;
  if (boundedMetadataText(raw.requestId, 256)) safe.requestId = raw.requestId;
  if (raw.originSource === "takbot") safe.originSource = raw.originSource;
  if (raw.generatedBy === "takbot") safe.generatedBy = raw.generatedBy;
  if (raw.knowledge === "not_retrieved") safe.knowledge = raw.knowledge;
  if (raw.version === 1) safe.version = raw.version;
  return safe;
}
export async function listStudioLibrary(
  findMany: (query: StudioLibraryQuery) => Promise<StudioLibraryRow[]>,
  clientId: string,
  filter: StudioLibraryFilter,
  source: string,
) {
  const rows = await findMany(studioLibraryQuery(clientId, filter, source));
  const hasMore = rows.length > STUDIO_LIBRARY_PAGE_SIZE && filter.offset + STUDIO_LIBRARY_PAGE_SIZE <= STUDIO_LIBRARY_MAX_OFFSET;
  const outputs = rows.slice(0, STUDIO_LIBRARY_PAGE_SIZE).map(row => ({ id: row.id, title: row.title, content: row.content,
    status: row.status, createdAt: row.createdAt.toISOString(), metadata: studioLibraryMetadata(row.metadata, source) }));
  return { outputs, hasMore, nextOffset: hasMore ? filter.offset + STUDIO_LIBRARY_PAGE_SIZE : null };
}

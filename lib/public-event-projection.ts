export type PublicEvent = { id: string; name: string; startAt: string; endAt?: string; timezone?: string; url: string; coverUrl?: string; location?: string; description?: string; recap?: string; photos?: string[] };
const dateString = (value: unknown): string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : undefined; }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return dateString(value.toDate().getTime());
  return undefined;
};
const string = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;
export function safePublicUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
}
export function projectPublicEvent(id: string, data: Record<string, unknown>): PublicEvent | null {
  if (data.visibility !== 'public') return null;
  const name = string(data.name) || string(data.title);
  const rawDate = data.startAt || data.start_at;
  const startAt = dateString(rawDate);
  const url = safePublicUrl(data.url || data.lumaUrl);
  if (!name || !startAt || !Number.isFinite(Date.parse(startAt)) || !url) return null;
  return { id, name, startAt, url, endAt: dateString(data.endAt || data.endAtIso), timezone: string(data.timezone), coverUrl: safePublicUrl(data.coverUrl), location: string(data.location) || string(data.address), description: string(data.description), recap: string(data.recap), photos: Array.isArray(data.photos) ? data.photos.map(safePublicUrl).filter((item): item is string => !!item) : undefined };
}

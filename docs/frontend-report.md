# Public frontend delivery

Implemented home, /events, /events/[id], /about, /privacy, /settings, branded loading/error/not-found, root providers, navigation and footer. Includes all 14 supplied community images on the about page, a three-photo homepage montage, original logo, cropped DC banner skyline, Cormorant Garamond and DM Sans, responsive purple/cream theme, dark/system themes, and required attribution.

Public events are dynamically read per request. `lib/public-event-projection.ts` explicitly selects public fields and rejects all visibility values except `public`; no guests, contact details, token, or job state is serialized. Dates normalize source milliseconds/ISO/Firestore dates. `PUBLIC_EVENTS_SOURCE=snapshot` intentionally selects the independently curated public snapshot during migration. Live empty query remains empty; a failed DB read falls back to the snapshot. Clear the environment override after migration verification. Archive paginates 12 per page with counts and anchor navigation. Registration always links to the original Luma URL. Event details do not invent missing descriptions or recaps.

Metadata uses configured site URL and temporary hosts are noindex. Canonical-only sitemap includes public events. Logo assets supply favicon, apple and social metadata. Settings links to root-owned /preferences and backend-owned /admin. No attendee content is included on public pages.

Verification:
- 3 built-in Node tests passed for visibility fail-closed, PII projection, malformed dates and unsafe URL schemes.
- Scoped public frontend ESLint passed.
- Shared typecheck initially only blocked by in-progress backend components/directory-control; final root checks own complete app.
- Chrome visual inspection at desktop and measured ~391 CSS pixels on mobile (viewport API required scale adjustment). No horizontal overflow measured on homepage, settings or event archive. Dark theme visibly applied and pressed state confirmed. Restored system theme afterward.
- Verified source-backed 2 upcoming / 20 past events, archive page 1 and 2, next/previous links, and real upcoming event detail /events/evt-BrurCegtuBzQjQD with original Luma registration link.
- Visual review caught original banner text clipping into mobile skyline and off-center invitation logo. Both corrected. Mobile event detail puts registration panel before the full content/cover.

Scaling: public query reads all public events and filters/paginates in memory, reasonable for current 22 records. Move pagination/filtering into indexed queries when the catalog reaches hundreds of events. No broad client cache: request-time status avoids stale upcoming dates. Snapshot update is an explicit editorial/build operation and must continue to use only source-confirmed public records.

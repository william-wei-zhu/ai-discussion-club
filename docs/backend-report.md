# Event admin and backend extraction

Implemented the independent AI Discussion Club event operations surface from the tested SuperIntro implementation.

## Admin and API surface

- `/admin` provides the Google plus password gated event console.
- Admin event reads, roster/contact edits, Luma sync, enrichment, match preparation, test send, cancel/arm, recommendation preview, participant XLSX export, and directory-link controls are wired through `/api/events/**`.
- `/api/club-unsubscribe` preserves the signed, category-separated historical opt-out behavior.
- `/api/cron/club-events` and `/api/cron/club-enrich` fail closed on cron authentication and return safe no-op results when jobs or providers are disabled.
- `/api/cron/club-sync` refreshes the event and contact mirror hourly without depending on the matching horizon.
- The private event API is covered by `proxy.ts`, which applies `private, no-store` response headers, and the admin fetcher also uses `cache: no-store`.
- The admin event list returns an honest integration status object for Luma, Vertex, Exa, Resend, jobs, and attendee sending. Missing providers do not prevent cached Firestore event and contact reads.

## Isolation and safety

- Firebase Admin is hard-pinned to `ai-discussion-club-260922`. A base64 service account for any other project is rejected before initialization.
- The upload bucket defaults to `ai-discussion-club-260922-uploads`.
- Vertex uses project `ai-discussion-club-260922`, location `global`, and explicit credentials decoded from `FIREBASE_SERVICE_ACCOUNT_B64` when present, with ADC available as the local fallback.
- The owner identity is fixed to `wzhu1997@gmail.com`; `ADMIN_PASSWORD` has no default and access fails closed when it is missing.
- Club email uses this app's `RESEND_API_KEY` (`CLUB_RESEND_API_KEY` remains a migration-compatible alias) and defaults to `AI Discussion Club <hello@aidiscussionclub.com>`.
- Live attendee delivery requires `EMAIL_SENDING_ENABLED=true`. Test copies are explicit admin actions and can only go to the fixed owner. Send success is stamped only after Resend returns successfully.
- `JOBS_ENABLED` and `EMAIL_SENDING_ENABLED` default to false in `.env.example`.
- `NEXT_PUBLIC_SITE_URL` supplies links. Request Host is never trusted for generated email URLs.

## Setup prerequisites

Required for admin access and cached reads:

- Firebase web config for project `ai-discussion-club-260922`
- `FIREBASE_SERVICE_ACCOUNT_B64` for that same project in deployed server environments
- `ADMIN_PASSWORD`

Required per integration:

- Luma: `LUMA_API_KEY`
- Vertex: Vertex AI access for the service account (or ADC locally), `GOOGLE_VERTEX_PROJECT=ai-discussion-club-260922`, `GOOGLE_VERTEX_LOCATION=global`
- Exa: `EXA_API_KEY`
- Email: a new `RESEND_API_KEY`, verified `hello@aidiscussionclub.com`, `UNSUBSCRIBE_SECRET`, and the stable `NEXT_PUBLIC_SITE_URL`
- Crons: `CRON_SECRET`; enable `JOBS_ENABLED` only after migration verification, and enable `EMAIL_SENDING_ENABLED` only after sender verification and old-sender shutdown

`/api/cron/club-sync` refreshes the Luma event and contact mirror hourly, independently of the matching horizon.

## Verification

- `npm test`: includes cron gates, send-time privacy filtering, and provider-error handling alongside the matching, Luma, unsubscribe, and URL suites.
- `npm run typecheck`: passed.
- `npm run build`: passed with all event, cron, unsubscribe, image, admin, public, directory, and preference routes compiled.

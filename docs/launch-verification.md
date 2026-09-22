# Initial launch verification

Verified on 2026-09-22 against https://ai-discussion-club-psi.vercel.app, application commit ab7755b.

- GitHub clean install, 85 tests, typecheck, lint and production build passed. Dependency audit reported zero vulnerabilities.
- Public home and event pages returned 200 and displayed the live Firestore public events. Branding and real photos were checked in a browser; mobile and dark mode were checked locally.
- Authenticated owner API reads returned 23 events and the contact summary. Owner identity with the wrong independent admin password returned 401; unauthenticated event reads returned 401. Google browser sign-in reached the password gate.
- Invalid private links returned 404 with private/no-store, no-referrer and noindex headers. Synthetic local integration verified approved opt-in inclusion, declined exclusion, absence of serialized email, and active-to-revoked link behavior. Fixtures were removed.
- The independent migration was verified: 1,345 contacts, 23 events, 424 send receipts, one existing opt-out. Imported events are all disarmed. No directory consent was inferred.
- Official apex and www are attached to the project; www redirects to apex. Registrar transfer still reports pending. The stable temporary production hostname is public; previews remain protected.

## Remaining activation work

Provide fresh Luma, Exa, Resend and PostHog keys. Verify the owned sender domain and an owner-only email test. Finish historical unsubscribe forwarding, reconcile changes since the staged copy, and pause the old club sender before enabling this one. Automatic jobs and attendee sending remain disabled; no real attendee emails were sent during verification. The new guests.email collection-group index was provisioned and its build must finish before preference membership queries can operate.

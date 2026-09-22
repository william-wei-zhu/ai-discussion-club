# Private directories and attendee preferences

The event directory is a secret-link surface backed by `directoryAccess/{eventId}`. A 32-byte URL-safe token is returned only when an administrator creates or rotates a link. Firestore stores only its SHA-256 hash. Revocation disables the record, and invalid, unknown, or revoked links all resolve to the same generic 404.

The `/g/:token` proxy matcher checks the hashed token, enabled flag, and event existence before React begins streaming. This preserves a real HTTP 404 status for invalid and revoked links despite the app-level loading boundary. Both successful and rejected directory responses set private no-store caching, no-referrer, and noindex headers. The rejected response is a standalone branded page and contains no profile data.

Directory reads require an active hashed token, approved guest or host membership, and an explicit `clubEvents/{eventId}/directoryConsent/{contactId}` document with `enabled: true`. Consent defaults to absent and therefore denied. The response model is an allowlist of name, short background, trusted LinkedIn URL, trusted Luma CDN photo, and host status. Email addresses, registration answers, low-confidence profiles, internal IDs, and enrichment records never enter the page model. Images from untrusted hosts are replaced with initials.

Administrators can create, rotate, and revoke links from the event controls. Status reads never return a token or URL. Create and rotate return the full secret URL once.

Members manage preferences without creating an account. They request a link using their registration email. The public result is generic to prevent account enumeration. Sending stays disabled unless `EMAIL_SENDING_ENABLED=true`, and requires `RESEND_API_KEY` plus `RESEND_CLUB_FROM`. Requests have a per-IP burst limit and a durable daily send cap. Set `PREFERENCE_EMAIL_DAILY_CAP` to override the default of 100.

Email links place the random token in the URL fragment, which is not sent in HTTP requests. The browser removes the fragment before exchanging the token in a POST. Tokens are stored hashed, expire after one hour, and are consumed once in a transaction. Successful exchange creates a separate hashed 30-minute session and an HttpOnly, SameSite=Lax cookie. The cookie is Secure except on localhost during development. Delivery is considered successful only when Resend returns a message ID. The send limit uses one fail-closed Firestore transaction for the hashed per-email hourly bucket, hashed per-IP hourly bucket, and global daily cap.

All preference mutations require an exact Origin match from `APP_ALLOWED_ORIGINS`. Localhost is accepted only outside production. Event consent changes are authorized again against server-side approved guest or host membership, so the client cannot opt into an unrelated event or change another attendee. A request that changes both email and directory settings commits through one Firestore batch, preventing partial preference updates.

Verification commands:

```sh
npm test
npm run typecheck
npm run lint
```

The HTTP integration check created a temporary synthetic event and access record, observed `200` while enabled, changed the record to revoked, and observed `404` for the same URL. Both synthetic records were deleted immediately after the check.

At current club size, the preference membership read scans event summaries and queries matching guest records by verified email. This is simple and bounded for the existing calendar. If event history grows into the thousands, add a contact-to-event membership index maintained by the sync job.

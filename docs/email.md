# Email and provider setup

## Domain distinction

Resend verifies the domain used in From, not the host of every link inside the email. `hello@aidiscussionclub.com` needs ownership verification, SPF and DKIM. A shared `vercel.app` hostname cannot be used as an owned sender domain. Email links may use the stable temporary site until the official site is available.

## Independent credentials

Use new LUMA_API_KEY, EXA_API_KEY, RESEND_API_KEY, PostHog project keys, and independently generated application secrets. Do not copy runtime keys from SuperIntro. Gemini uses Vertex AI with the dedicated project and service account; the tested model is gemini-3.1-flash-lite in global.

Create the sender domain in Resend and install its exact DNS verification records in authoritative DNS (and Vercel's prepared zone if propagation is pending). Existing inbound MX records must be preserved. Restrict the new sending API key to the verified domain where supported. Configure a signed webhook for bounces/complaints before broad sends.

Set EMAIL_SENDING_ENABLED=true only after owner-only test delivery, unsubscribe verification, historical preference reconciliation, old-sender pause, and historical unsubscribe compatibility are complete. JOBS_ENABLED is a separate gate. New events synced from Luma are armed for the T-24h send by default (`CLUB_AUTOSEND_DEFAULT`, on unless set to `false`); the owner can disarm or pause any event in admin. Events imported by the migration stay disarmed until armed by hand. Never enable attendee sending in branch previews.

## Missing integrations

Luma and Exa require new keys supplied by the owner. Site event browsing reads the verified copy in the independent Firestore database. The explicit snapshot mode is only a bootstrap option. The admin displays missing integrations and blocks unavailable actions; no fake success or provider-less send receipts.

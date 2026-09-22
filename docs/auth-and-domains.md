# Authentication and domains

## Why this setup

Firebase Google authentication and Firestore belong to the new `ai-discussion-club-260922` project. Both the stable temporary host (`ai-discussion-club-psi.vercel.app`) and the official domain are authorized. Random deployment preview hosts are not implicitly trusted. Root environment determines generated links, never an untrusted Host header.

Google sign-in uses the project's dedicated Firebase OAuth client. The auth domain remains `ai-discussion-club-260922.firebaseapp.com`; popup sign-in does not require proxying auth handlers through every site hostname. Admin access additionally checks the verified owner email and ADMIN_PASSWORD server-side.

## Verify

Sign in with the owner account on /admin, enter the independent password, and confirm contact counts. Missing/wrong password or non-owner identity must receive 401. The two hostnames are separate browser origins, so a login/session does not automatically carry between them.

The domain registrar transfer was submitted and Cloudflare release approved on 2026-09-22. Vercel DNS is prepared. Until Vercel completes processing and nameservers resolve there, use the temporary site. At switch-over, update NEXT_PUBLIC_SITE_URL and re-deploy, preserve exact allowed hosts, configure www to redirect to the apex, and test HTTPS and Google sign-in again. Do not switch canonical indexing while the official domain is unavailable.

## Rules and service identity

Firestore client access is deny-all; server endpoints enforce authorization and field projection. Rules are deployed separately from Vercel. Runtime service account has datastore.user and aiplatform.user only in the new project, plus storage.objectUser on its dedicated uploads bucket. The private local credential and Vercel secret must never be committed.

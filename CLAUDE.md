# AI Discussion Club implementation notes

Read AGENTS.md, docs/plan.md and ../web-app-building-standard/SKILL.md.

2026-09-22: independent application extracted from SuperIntro's club feature. Dedicated project ai-discussion-club-260922 prevents accidental cross-app writes. Old credentials are never runtime dependencies. Club collections retain original IDs to preserve matching and delivery history.

2026-09-22: temporary stable Vercel hostname is ai-discussion-club-psi.vercel.app, not ai-discussion-club.vercel.app (Vercel assigned a suffix). Authentication explicitly allows the stable temporary and official domains. Sender remains on the owned official domain, independent of website link host.

2026-09-22: imported event jobs remain disarmed and global sending/jobs gates remain false pending provider setup and final migration cutover. This preserves existing operational emails in SuperIntro without double sending.

2026-09-22: public event reads strictly project fields and require explicit public visibility. Snapshot mode is explicit, never silently republish an empty live calendar. Directory consent is per event and never inferred from past registration.

Scaling: the inherited admin/matcher loads club contacts in memory at current ~1,200-person scale. Revisit at 10,000 contacts; use indexed server pagination and bounded matching batches. Public lists paginate at 12 entries.

2026-09-22: Verified the staged database independently (1,345 contacts, 23 events, 424 send receipts, one opt-out; all imported events disarmed). Public source changed from snapshot to Firestore after confirming 22 public events and two upcoming; runtime read failures no longer republish an old snapshot.
2026-09-22: ExcelJS uuid override ^11.1.1 resolves the remaining moderate advisory; conditional-format XLSX write/read roundtrip passed.

2026-09-22: Explicit Next.js framework added to vercel.json and the project, because an API-created generic project built successfully but served only static public files. Production hostname is public; branch previews retain Vercel authentication.
2026-09-22: Refreshed optional native dependency entries with npm 12 in an isolated lockfile workspace after GitHub's clean install found missing emnapi entries. npm 12 clean-install dry run now passes. Added guests.email collection-group index for preference membership queries, discovered by testing against the new database.
2026-09-22: Directory proxy validates the capability before Next.js begins streaming, ensuring revoked links return real HTTP 404. Synthetic active/revoked HTTP checks passed and fixtures were removed. Preference writes are atomic; delivery errors do not reveal membership.

2026-09-22: Promoted the supplied wooden-wall group portrait (community-02.png) to the first featured community photo, replacing the selfie. Its full-width natural aspect ratio keeps the full group visible on desktop and mobile; the previous photo remains in the gallery.

2026-09-22: Replaced the earlier italic/accent phrase styling at the owner's request. Every heading and sentence now has uniform font, color, size, weight and style, including admin summaries. Removed italic font loading and added inherited inline typography. The shared building standard now explicitly prohibits this pattern, replacing its old italic-tagline rule.

2026-09-22: Show the synced Luma coverUrl in every public event list (home, upcoming and archive), plus an optimized full cover on event detail pages. All 23 migrated events currently contain cover URLs. Source is Luma cover_url via the independent Firestore mirror.

2026-09-22: Created new Luma, Exa and Resend keys after owner confirmation and installed them as sensitive production secrets in this project's Vercel environment. Luma is scoped to the AI Discussion Club calendar; Exa is named AI Discussion Club; Resend is sending-only and scoped to aidiscussionclub.com. No SuperIntro provider key was reused. Sensitive production keys cannot be pulled back into .env.local; local development still needs independently provisioned keys. First live production Luma sync returned HTTP 200, refreshed 23 events, and processed 1,459 calendar contacts. Jobs and attendee sending remain disabled pending migration cutover.

2026-09-22: Domain transfer completed to Vercel with auto-renew enabled and expiration 2028-02-06 UTC. Official HTTPS website returned 200; public DNS resolves to Vercel nameservers while some provider caches still show Cloudflare. Added Resend's exact DKIM TXT and send/rsend CNAME records plus DMARC in Vercel. Resend verification is propagating. NEXT_PUBLIC_SITE_URL now uses https://aidiscussionclub.com; the temporary hostname remains allowed for authentication and origins.

2026-09-22: Use event/events consistently in website copy, accessibility labels, empty states and private-directory fallbacks. Updated the separate admin password to the owner-requested value in private configuration; Google owner verification remains required.

2026-09-22: Keep the header wordmark on one line; removed its forced line break and prevent wrapping. The compact mobile header retains its logo-only treatment.
2026-09-24: Cutover from SuperIntro. SuperIntro's club-events/club-enrich crons are removed and its club email senders throw (commit 2fd7c5a in superintro), so this app is the only club sender. Owner-only test ("[test] 5 people to meet at Picnic Discussion") delivered from hello@aidiscussionclub.com to the inbox with SPF, DKIM and DMARC pass; Sep 27 event prepared (57 confirmed) and armed by the owner. New events now default to autoSend on (`CLUB_AUTOSEND_DEFAULT` unless "false"), stamped `autoSendArmedBy: "default"`; existing and migrated events are unchanged.
2026-09-24: Went live. JOBS_ENABLED and EMAIL_SENDING_ENABLED set to true in production and redeployed; admin shows "Background jobs enabled · attendee email enabled". All four upcoming events (Sep 27, Oct 10, Oct 24, Nov 4) armed via the admin switch, clearing the migration-safety pause on Oct 10. Future events arm by default, so no manual step is needed per event.
2026-09-24: Owner-approved switch of private event directories from opt-in to OPT-OUT. `/g/[token]` now lists every going guest and host unless they set directoryConsent enabled=false for that event in /preferences (toggle defaults on). Cards unchanged: name, headline, Luma photo, LinkedIn only at given/high confidence; never email or answers. Privacy, preferences and directory copy updated to match.
2026-09-24: Directory cards now prefer the contact's LinkedIn photo (`linkedinPhoto`, either /api/img/avatars/... or https *.licdn.com) when the LinkedIn profile is trusted (given/high), falling back to the Luma avatar.

# Club migration

The source project is `belinkup`; the independent destination is `ai-discussion-club-260922`. The migration script uses the operator's local application-default credentials, never embeds source credentials in the deployed app. Source operations are read-only.

Run `node --import tsx scripts/migrate-club.ts` for counts, then add `--apply` to copy the two club collection trees and referenced club avatars. Existing destination documents are skipped, preserving local preferences. Source opt-outs, recipient send receipts and matching history are retained. Imported events are forcibly disarmed. No directory consent is inferred from existing data.

Before production email cutover: configure dedicated providers, verify owner-only test delivery, pause old club jobs, reconcile registrations and historical send/opt-out changes, implement historical unsubscribe forwarding with an independently generated bridge secret, then enable the new sender. The old unsubscribe endpoint must continue accepting its historical signatures and forward only verified contact opt-outs to the new app, with durable retry on failure. Do not reuse its signing secret in the new app. Historical note: cutover completed 2026-09-24. `JOBS_ENABLED` and `EMAIL_SENDING_ENABLED` are true in production and SuperIntro's club jobs are removed; see CLAUDE.md.

Rollback: disable the new sender before resuming the old sender. Never enable both. Migration does not delete source data or change unrelated SuperIntro features. Private migration reports are excluded from Git. A later reconciliation must merge monotonic send/opt-out state rather than overwrite newer local preferences.

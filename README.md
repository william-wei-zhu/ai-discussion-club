# AI Discussion Club

The official home of AI Discussion Club, a community for curious minds and builders in Washington, DC.

- Temporary site: https://ai-discussion-club-psi.vercel.app
- Official domain: https://aidiscussionclub.com
- Calendar: https://luma.com/ai-discussion-club
- Owner console: /admin

## Development

Node 24, `npm install`, copy `.env.example` to `.env.local`, then `npm run dev`. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` before release.

This app uses a dedicated Google Cloud/Firebase project, `ai-discussion-club-260922`. Never substitute the SuperIntro project or API keys. Read `docs/plan.md`, `docs/migration.md`, and the integration runbooks.

Public pages use only explicitly public Luma event data. Attendee profiles, registrations and email addresses are server-only. Secret directories require explicit event-specific consent and can be revoked. The admin requires an owner Google identity plus a separate password.

## Deployment

GitHub main deploys through Vercel. Production may initially use the stable temporary hostname; branch previews have no production credentials. Do not manually deploy production after a push that already triggers deployment.

`PUBLIC_EVENTS_SOURCE=snapshot` enables a curated public-only snapshot while integrations are being configured. Unset it after the migration and live sync are verified. It is never an automatic fallback for an intentionally empty live event list.

Sending and automatic jobs are disabled until all new providers and migration cutover checks are complete. The public website can operate independently of these optional integrations.

Initial release reads the verified independent Firestore copy directly (`PUBLIC_EVENTS_SOURCE=firestore`). Luma sync, Exa enrichment, Resend delivery and analytics each need a new club-specific provider key; those keys are intentionally not copied from SuperIntro. Historical unsubscribe forwarding and a final reconciliation are required before enabling the new sender.

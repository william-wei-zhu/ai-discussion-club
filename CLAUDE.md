# AI Discussion Club implementation notes

Read AGENTS.md, docs/plan.md and ../web-app-building-standard/SKILL.md.

2026-09-22: independent application extracted from SuperIntro's club feature. Dedicated project ai-discussion-club-260922 prevents accidental cross-app writes. Old credentials are never runtime dependencies. Club collections retain original IDs to preserve matching and delivery history.

2026-09-22: temporary stable Vercel hostname is ai-discussion-club-psi.vercel.app, not ai-discussion-club.vercel.app (Vercel assigned a suffix). Authentication explicitly allows the stable temporary and official domains. Sender remains on the owned official domain, independent of website link host.

2026-09-22: imported event jobs remain disarmed and global sending/jobs gates remain false pending provider setup and final migration cutover. This preserves existing operational emails in SuperIntro without double sending.

2026-09-22: public event reads strictly project fields and require explicit public visibility. Snapshot mode is explicit, never silently republish an empty live calendar. Directory consent is per event and never inferred from past registration.

Scaling: the inherited admin/matcher loads club contacts in memory at current ~1,200-person scale. Revisit at 10,000 contacts; use indexed server pagination and bounded matching batches. Public lists paginate at 12 entries.

2026-09-22: Verified the staged database independently (1,345 contacts, 23 events, 424 send receipts, one opt-out; all imported events disarmed). Public source changed from snapshot to Firestore after confirming 22 public events and two upcoming; runtime read failures no longer republish an old snapshot.
2026-09-22: ExcelJS uuid override ^11.1.1 resolves the remaining moderate advisory; conditional-format XLSX write/read roundtrip passed.

# Data and rules

The application uses the dedicated Google Cloud/Firebase project `ai-discussion-club-260922`. All browser Firestore access is denied. Every data operation runs through server routes; admin routes require the owner's verified Firebase identity and independent password. The server identity can access only this project's application resources.

The default-deny rules were deployed separately before initial app launch. Vercel deployments do not deploy Firestore rules. The Firestore rules GitHub workflow skips cleanly until a dedicated rules-deployment service-account JSON is stored as the base64 repository secret `FIREBASE_RULES_CREDENTIALS_B64`. Grant that identity only the permissions needed to deploy Firebase rules in this project; never use the runtime or source-app identity for CI.

Verification: inspect the active `cloud.firestore` ruleset in Firebase, confirm the deny-all rule, and attempt a browser SDK read without server privileges. Private data lives in `clubContacts` and `clubEvents` with their subcollections; public event responses use a field projection and require explicit public visibility. Directories add explicit per-event consent and revocable hashed bearer tokens.

Counts on the initial staged copy: 1,345 contacts, 23 events, 17,795 documents, 55 avatar objects. All events are disarmed. Reports are private and excluded from Git. See migration.md for final reconciliation and email cutover.

Preferences require the collection-group ascending index on `guests.email`. It is declared in firestore.indexes.json and was provisioned separately in the dedicated project on 2026-09-22. Deploy indexes with `firebase deploy --only firestore:indexes --project ai-discussion-club-260922` when this configuration changes. Index creation may take several minutes; validate the actual collection-group query after it reports ready.

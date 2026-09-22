/** Club-only copy. Source is read-only; destination writes require --apply. */
import { Firestore } from "@google-cloud/firestore";
import { Storage } from "@google-cloud/storage";
import { mkdir, writeFile } from "node:fs/promises";

const apply = process.argv.includes("--apply");
const source = new Firestore({ projectId: "belinkup" });
const destination = new Firestore({ projectId: "ai-discussion-club-260922" });
const sourceStorage = new Storage({ projectId: "belinkup" });
const targetStorage = new Storage({ projectId: "ai-discussion-club-260922" });
const report = { apply, source: "belinkup", destination: "ai-discussion-club-260922", documents: 0, contacts: 0, events: 0, optOuts: 0, sent: 0, avatars: 0, skippedExisting: 0 };
const avatarKeys = new Set<string>();

async function copyCollection(path: string) {
  const docs = (await source.collection(path).get()).docs;
  for (let offset = 0; offset < docs.length; offset += 12) {
   await Promise.all(docs.slice(offset, offset + 12).map(async doc => {
    const data = doc.data();
    report.documents++;
    if (path === "clubContacts") {
      report.contacts++;
      if (data.emailOptOut === true) report.optOuts++;
      if (typeof data.linkedinPhoto === "string" && data.linkedinPhoto.startsWith("/api/img/avatars/club-")) {
        avatarKeys.add(data.linkedinPhoto.slice("/api/img/".length));
      }
    }
    if (path === "clubEvents") report.events++;
    if (path.endsWith("/recs") && data.emailedAt) report.sent++;
    if (apply) {
      // Copy-once protects local preferences and edits from accidental reruns.
      // The final reconciliation is a separate explicit operation at cutover.
      const ref = destination.doc(doc.ref.path);
      await destination.runTransaction(async tx => {
        if ((await tx.get(ref)).exists) { report.skippedExisting++; return; }
        tx.create(ref, path === "clubEvents" ? { ...data, autoSend: false, cancelled: true, cancelledBy: "migration-safety", migratedAt: Date.now() } : data);
      });
    }
    for (const sub of await doc.ref.listCollections()) await copyCollection(sub.path);
    }));
    if (!path.includes("/")) console.log(`${path}: ${Math.min(offset+12,docs.length)}/${docs.length}`);
  }
}

async function main() {
await copyCollection("clubContacts");
await copyCollection("clubEvents");
for (const key of avatarKeys) {
  report.avatars++;
  if (apply) {
    const target = targetStorage.bucket("ai-discussion-club-260922-uploads").file(key);
    if (!(await target.exists())[0]) {
      await sourceStorage.bucket("belinkup-uploads").file(key).copy(target);
    }
  }
}
await mkdir("private", { recursive: true, mode: 0o700 });
await writeFile(`private/migration-${apply ? "applied" : "dry-run"}.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
await Promise.all([source.terminate(), destination.terminate()]);

}
main().catch(e => { console.error(e.message); process.exitCode = 1; });

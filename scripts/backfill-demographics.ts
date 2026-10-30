// One-time (and re-runnable) backfill of audience labels for everyone who has
// attended an event. Skips anyone already labelled with the current version.
//   node --env-file=.env.local --import tsx scripts/backfill-demographics.ts --limit 20
//   ... --rebuild   (also refresh the clubMeta/audience summary afterwards)
import { classifyPending, rebuildClubAudience } from "@/lib/audience";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const limit = Number(arg("limit") ?? 2000);
  const result = await classifyPending({ limit, deadlineMs: Date.now() + 3_600_000, typesafeCap: 5000, geminiCap: 5000 });
  console.log(JSON.stringify(result));
  if (process.argv.includes("--rebuild")) {
    const a = await rebuildClubAudience();
    console.log(JSON.stringify({ people: a.people, classified: a.classified, dimensions: a.dimensions.map((d) => [d.key, d.known]), employers: a.employers.length }));
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

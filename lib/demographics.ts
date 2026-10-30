// Anonymized audience statistics: who comes to AI Discussion Club, as a whole and
// per event. Pure on purpose (no Firestore, no network) so the privacy rules here
// are unit-tested: lib/audience.ts does the reads and the model calls.
//
// Privacy rules, in one place:
//  - nobody is shown individually: only counts per bucket;
//  - every category is shown with its real share, however small (owner's call,
//    2026-10-30: the detail matters more than folding small groups together);
//  - a dimension with fewer than MIN_PEOPLE known answers is not shown at all;
//  - an employer is named only when at least MIN_EMPLOYER people work there;
//  - a page with fewer than MIN_PEOPLE classified people says so and shows nothing.

import type { ChoiceAnswer, ChoiceQuestion } from "@/lib/typesafe";

export const MIN_PEOPLE = 10;
export const MIN_EMPLOYER = 3;
// Below this Jev confidence an answer is stored as unknown, so the totals only
// count labels the model is sure of.
export const MIN_CONFIDENCE = 0.6;
// Bump when a question or option changes, so every cached label is rebuilt.
export const DIMENSIONS_VERSION = 1;

export type DimensionKey = "ageBand" | "experience" | "role" | "sector" | "seniority" | "education";

type Dimension = {
  key: DimensionKey;
  title: string;
  note?: string;
  // Ordinal dimensions keep this order; the others sort largest first.
  ordinal: boolean;
  instructions: string;
  options: { id: string; label: string; criteria: string }[];
};

const UNKNOWN = { id: "unknown", label: "Unknown", criteria: "The profile does not give enough information to tell." };

export const DIMENSIONS: Dimension[] = [
  {
    key: "ageBand", title: "Estimated age", note: "Estimated from graduation years and career length.", ordinal: true,
    instructions: "Estimate this person's current age band. Use graduation years (a bachelor's degree usually ends around age 22) and the length of their career. The current year is {year}. Answer unknown when there are no dates to go on.",
    options: [
      { id: "under25", label: "Under 25", criteria: "Younger than 25: a current student or graduated in the last couple of years." },
      { id: "25-34", label: "25 to 34", criteria: "Between 25 and 34 years old." },
      { id: "35-44", label: "35 to 44", criteria: "Between 35 and 44 years old." },
      { id: "45-54", label: "45 to 54", criteria: "Between 45 and 54 years old." },
      { id: "55plus", label: "55 and over", criteria: "55 years old or older." },
      UNKNOWN,
    ],
  },
  {
    key: "experience", title: "Years of experience", ordinal: true,
    instructions: "How many years of full-time professional work experience does this person have, excluding internships? The current year is {year}.",
    options: [
      { id: "student", label: "Student", criteria: "Currently a full-time student with little or no full-time work yet." },
      { id: "0-4", label: "Under 5 years", criteria: "Less than 5 years of full-time work." },
      { id: "5-9", label: "5 to 9 years", criteria: "Between 5 and 9 years of full-time work." },
      { id: "10-19", label: "10 to 19 years", criteria: "Between 10 and 19 years of full-time work." },
      { id: "20plus", label: "20 years or more", criteria: "20 or more years of full-time work." },
      UNKNOWN,
    ],
  },
  {
    key: "role", title: "What they do", ordinal: false,
    instructions: "What is this person's main kind of work in their current role?",
    options: [
      { id: "engineering", label: "Software engineering", criteria: "Builds software: software, platform, infrastructure or full-stack engineering." },
      { id: "ai-data", label: "AI, ML and data", criteria: "Machine learning, AI engineering, data science, data engineering or analytics." },
      { id: "research", label: "Research and academia", criteria: "Academic or industrial research, professors, PhD students, research scientists." },
      { id: "product", label: "Product and design", criteria: "Product management, product design, UX." },
      { id: "founder", label: "Founders and executives", criteria: "Founded or runs a company: founder, co-founder, CEO, CTO or other C-level." },
      { id: "business", label: "Sales, marketing and growth", criteria: "Sales, business development, marketing, growth, partnerships, community." },
      { id: "policy", label: "Policy, law and government", criteria: "Public policy, government service, legal, regulatory or compliance work." },
      { id: "consulting", label: "Consulting and strategy", criteria: "Management or technology consulting, strategy, advisory." },
      { id: "finance", label: "Finance and investing", criteria: "Venture capital, investing, banking, financial analysis." },
      { id: "operations", label: "Operations and program management", criteria: "Operations, program or project management, people or HR." },
      { id: "other", label: "Other", criteria: "Some other kind of work, such as healthcare, education, the arts or media." },
      UNKNOWN,
    ],
  },
  {
    key: "sector", title: "Where they work", ordinal: false,
    instructions: "What kind of organization is this person's current employer?",
    options: [
      { id: "big-tech", label: "Large tech companies", criteria: "A large established technology company with thousands of employees." },
      { id: "startup", label: "Startups", criteria: "A startup or young venture-backed company, including their own." },
      { id: "government", label: "Government", criteria: "Federal, state or local government, including agencies and the military." },
      { id: "contractor", label: "Government contractors and defense", criteria: "A government contractor, systems integrator or defense company." },
      { id: "consulting", label: "Consulting firms", criteria: "A consulting or professional services firm." },
      { id: "finance", label: "Finance", criteria: "A bank, investment firm, venture fund, insurer or fintech." },
      { id: "academia", label: "Universities and schools", criteria: "A university, research lab at a university, or school." },
      { id: "nonprofit", label: "Nonprofits and think tanks", criteria: "A nonprofit, foundation, think tank or international organization." },
      { id: "enterprise", label: "Other established companies", criteria: "An established non-tech company: healthcare, media, retail, energy, telecom and so on." },
      { id: "independent", label: "Independent", criteria: "Self-employed, freelance, or between jobs." },
      UNKNOWN,
    ],
  },
  {
    key: "seniority", title: "Seniority", ordinal: true,
    instructions: "What is the seniority of this person's current role?",
    options: [
      { id: "student", label: "Student", criteria: "A student or intern." },
      { id: "ic", label: "Individual contributor", criteria: "An individual contributor, including senior and staff levels, who does not manage people." },
      { id: "manager", label: "Manager", criteria: "Manages a team: manager, team lead, senior manager." },
      { id: "director", label: "Director or VP", criteria: "Director, head of, vice president or partner level." },
      { id: "executive", label: "Founder or C-suite", criteria: "Founder, co-founder, owner, CEO, CTO or other C-level." },
      UNKNOWN,
    ],
  },
  {
    key: "education", title: "Highest degree", ordinal: true,
    instructions: "What is the highest degree this person has completed or is studying for?",
    options: [
      { id: "bachelor", label: "Bachelor's", criteria: "A bachelor's degree, or currently an undergraduate." },
      { id: "master", label: "Master's", criteria: "A master's degree other than an MBA." },
      { id: "mba", label: "MBA", criteria: "An MBA." },
      { id: "doctorate", label: "PhD, JD or MD", criteria: "A doctorate such as a PhD, or a professional doctorate such as a JD or MD." },
      UNKNOWN,
    ],
  },
];

export type DemographicLabels = Partial<Record<DimensionKey, string>>;
export type DemographicRow = DemographicLabels & { employer?: string };

export function demographicQuestions(year = new Date().getUTCFullYear()): Record<string, ChoiceQuestion> {
  return Object.fromEntries(DIMENSIONS.map((d) => [d.key, {
    type: "choice",
    instructions: d.instructions.replace("{year}", String(year)),
    criteria: Object.fromEntries(d.options.map((o) => [o.id, o.criteria])),
  } satisfies ChoiceQuestion]));
}

// Keep a label only when it is a real option, not "unknown", and confident enough.
export function labelsFromAnswers(answers: Record<string, ChoiceAnswer | undefined>, minConfidence = MIN_CONFIDENCE): { labels: DemographicLabels; confidences: Partial<Record<DimensionKey, number>> } {
  const labels: DemographicLabels = {};
  const confidences: Partial<Record<DimensionKey, number>> = {};
  for (const d of DIMENSIONS) {
    const a = answers[d.key];
    if (!a || typeof a.choice !== "string") continue;
    const confidence = typeof a.confidence === "number" ? a.confidence : 0;
    confidences[d.key] = Math.round(confidence * 100) / 100;
    if (a.choice === "unknown" || confidence < minConfidence) continue;
    if (d.options.some((o) => o.id === a.choice)) labels[d.key] = a.choice;
  }
  return { labels, confidences };
}

// One key per employer however it is written: "Google LLC", "google", "Google, Inc."
export function employerKey(name: string): string {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(inc|llc|ltd|corp|corporation|co|plc|the)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

export type AudienceBar = { id: string; label: string; count: number; percent: number };
export type AudienceDimension = { key: DimensionKey; title: string; note?: string; known: number; bars: AudienceBar[] };
export type AudienceSummary = {
  people: number;
  classified: number;
  tooSmall: boolean;
  dimensions: AudienceDimension[];
  employers: { name: string; count: number }[];
};

export function aggregateDemographics(rows: DemographicRow[], opts: { minPeople?: number; minEmployer?: number; maxEmployers?: number } = {}): AudienceSummary {
  const minPeople = opts.minPeople ?? MIN_PEOPLE;
  const minEmployer = opts.minEmployer ?? MIN_EMPLOYER;
  const classified = rows.filter((r) => DIMENSIONS.some((d) => r[d.key])).length;
  const empty: AudienceSummary = { people: rows.length, classified, tooSmall: true, dimensions: [], employers: [] };
  if (classified < minPeople) return empty;

  const dimensions: AudienceDimension[] = [];
  for (const d of DIMENSIONS) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = r[d.key];
      if (v && d.options.some((o) => o.id === v && o.id !== "unknown")) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const known = [...counts.values()].reduce((a, b) => a + b, 0);
    if (known < minPeople) continue;
    const bars: AudienceBar[] = d.options
      .filter((o) => counts.get(o.id))
      .map((o) => ({ id: o.id, label: o.label, count: counts.get(o.id) ?? 0, percent: 0 }));
    // Largest first, with the catch-all "Other" last; ordinal scales keep their order.
    if (!d.ordinal) bars.sort((a, b) => Number(a.id === "other") - Number(b.id === "other") || b.count - a.count);
    for (const bar of bars) bar.percent = Math.round((bar.count / known) * 100);
    dimensions.push({ key: d.key, title: d.title, ...(d.note ? { note: d.note } : {}), known, bars });
  }

  const employers = new Map<string, { count: number; names: Map<string, number> }>();
  for (const r of rows) {
    const name = r.employer?.trim();
    if (!name) continue;
    const key = employerKey(name);
    if (!key) continue;
    const entry = employers.get(key) ?? { count: 0, names: new Map() };
    entry.count++;
    entry.names.set(name, (entry.names.get(name) ?? 0) + 1);
    employers.set(key, entry);
  }
  const topEmployers = [...employers.values()]
    .filter((e) => e.count >= minEmployer)
    .map((e) => ({ name: [...e.names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0], count: e.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, opts.maxEmployers ?? 12);

  return { people: rows.length, classified, tooSmall: false, dimensions, employers: topEmployers };
}

// One person, one row. Contacts are already one per Luma account (attending many
// events never repeats anyone), but some people have two Luma accounts, e.g. a work
// and a personal email. Those share a trusted LinkedIn profile, so rows with the same
// profile merge, keeping the most complete labels. Placeholder handles typed into
// registration forms ("/in/na", "/in/test") are shared by different people and never
// merge. Names alone are not unique enough to merge on.
const PLACEHOLDER_HANDLES = new Set(["na", "n-a", "none", "test", "no", "null", "linkedin", "me"]);
export function personKey(linkedinUrl: string | undefined): string | null {
  const handle = linkedinUrl?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]?.toLowerCase();
  if (!handle || handle.length < 3 || PLACEHOLDER_HANDLES.has(handle)) return null;
  return handle;
}
export function dedupePeople<T extends DemographicRow>(rows: (T & { linkedinUrl?: string })[]): T[] {
  const labelled = (r: DemographicRow) => DIMENSIONS.filter((d) => r[d.key]).length + (r.employer ? 1 : 0);
  const out: (T & { linkedinUrl?: string })[] = [];
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = personKey(row.linkedinUrl);
    const at = key ? seen.get(key) : undefined;
    if (at === undefined) { if (key) seen.set(key, out.length); out.push(row); }
    else if (labelled(row) > labelled(out[at])) out[at] = row;
  }
  return out.map((row) => {
    const copy: T & { linkedinUrl?: string } = { ...row };
    delete copy.linkedinUrl;
    return copy;
  });
}

// Which of an event's guests count toward its audience. Going guests and hosts,
// never someone who hid themselves from the event's directory. Once an event has
// enough check-ins to report on, only the people who actually came.
export function audienceGuestIds(guests: { id: string; approvalStatus?: unknown; isHost?: unknown; checkedInAt?: unknown }[], optedOut: Set<string>): string[] {
  const going = guests.filter((g) => !optedOut.has(g.id) && (g.approvalStatus === "approved" || g.isHost === true));
  const checkedIn = going.filter((g) => typeof g.checkedInAt === "number" && g.checkedInAt > 0);
  return (checkedIn.length >= MIN_PEOPLE ? checkedIn : going).map((g) => g.id);
}

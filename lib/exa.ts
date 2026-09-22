import Exa from "exa-js";
import { normalizeLinkedInUrl, sameLinkedInHandle } from "@/lib/linkedin";

let client: Exa | null = null;

function exa(): Exa {
  if (!client) {
    const key = process.env.EXA_API_KEY;
    if (!key) throw new Error("EXA_API_KEY is not set");
    client = new Exa(key);
  }
  return client;
}

export interface RawProfile {
  url: string;
  name: string;
  text: string;
  image?: string; // og:image on the profile, which is the profile photo
}

// Enrich a LinkedIn profile URL into raw text we can hand to the LLM.
export async function fetchLinkedInProfile(
  url: string,
): Promise<RawProfile | null> {
  // Enough text to include the About section plus experience and education,
  // which carry the credibility signals (current/past employers, school).
  const res = await exa().getContents([url], {
    text: { maxCharacters: 10000 },
  });
  const r = res.results?.[0];
  if (!r || !r.text) return null;
  // Reject a nearest-match swap: if Exa resolved a DIFFERENT profile than the one
  // requested, its url/name/text are a stranger's, so treat it as unreadable (the
  // caller then falls into manual entry with the user's own URL preserved) rather
  // than importing the wrong person. Return the requested canonical URL so the
  // user's submitted identity stays authoritative, never Exa's resolved value.
  if (!sameLinkedInHandle(url, r.url ?? "")) return null;
  return { url, name: r.title ?? "", text: r.text, image: (r as { image?: string }).image };
}

export interface PersonCandidate {
  name: string;
  headline: string;
  linkedinUrl: string;
  text: string;
  image?: string; // og:image from the result (often the profile photo)
}

// Find a person's LinkedIn from their name using Exa's people search.
export async function findPeople(query: string): Promise<PersonCandidate[]> {
  const res = await exa().search(query, {
    type: "auto",
    category: "people",
    numResults: 3,
    contents: { text: { maxCharacters: 4000 } },
  });
  const out: PersonCandidate[] = [];
  for (const r of res.results ?? []) {
    const url = normalizeLinkedInUrl(r.url ?? "");
    if (!url) continue; // only keep LinkedIn-resolvable results
    const text = (r as { text?: string }).text ?? "";
    const name = (r.title ?? "").toLowerCase();
    // First real content line: skip markdown headers and the name itself.
    const headline =
      text
        .split("\n")
        .map((l) => l.replace(/^#+\s*/, "").trim())
        .filter(Boolean)
        .find((l) => l.toLowerCase() !== name && !l.startsWith("![")) ?? "";
    out.push({
      name: r.title ?? "",
      headline: headline.slice(0, 140),
      linkedinUrl: url,
      text,
      image: (r as { image?: string }).image,
    });
  }
  return out;
}

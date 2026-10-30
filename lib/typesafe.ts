// TypeSafe Jev: a decision model that answers typed questions (here, one "choice"
// per audience dimension) with calibrated probabilities. Text in, labels out, no
// generation, so there is nothing to parse and nothing to hallucinate.
// A non-Google provider on purpose, like Resend; see CLAUDE.md (2026-10-30).

const BASE = process.env.TYPESAFE_API_BASE ?? "https://api.typesafe.ai/v1";
// Pinned by explicit id: an alias such as jev-latest would change labels under us.
export const JEV_MODEL = process.env.TYPESAFE_MODEL ?? "jev-1.14.0";

export type ChoiceQuestion = { type: "choice"; instructions: string; criteria: Record<string, string> };
export type ChoiceAnswer = { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };

export function typesafeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export async function askChoices(
  state: string | Record<string, unknown>,
  questions: Record<string, ChoiceQuestion>,
): Promise<Record<string, ChoiceAnswer>> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error("TYPESAFE_API_KEY is not set.");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/systemone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429 && attempt < 3) {
      const wait = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`TypeSafe ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json() as { answers?: Record<string, ChoiceAnswer> };
    return body.answers ?? {};
  }
}

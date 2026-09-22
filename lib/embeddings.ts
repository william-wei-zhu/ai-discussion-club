import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

function serviceAccountCredentials() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!encoded) return undefined;
  const json = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  if (json.project_id !== "ai-discussion-club-260922") throw new Error("Vertex credentials belong to the wrong project.");
  return { client_email: json.client_email, private_key: json.private_key };
}

function ai(): GoogleGenAI {
  if (!client) {
    const project = process.env.GOOGLE_VERTEX_PROJECT ?? "ai-discussion-club-260922";
    if (project !== "ai-discussion-club-260922") throw new Error("Vertex project is not the AI Discussion Club project.");
    client = new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env.GOOGLE_VERTEX_LOCATION ?? "global",
      googleAuthOptions: { credentials: serviceAccountCredentials() },
    });
  }
  return client;
}

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
const EMBED_DIMS = 768;

// Embed one or more texts. Returns one vector per input (EMBED_DIMS-dimensional).
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const resp = await ai().models.embedContent({
    model: EMBED_MODEL,
    contents: texts,
    config: { outputDimensionality: EMBED_DIMS },
  });
  const vectors = resp.embeddings?.map((e) => e.values ?? []) ?? [];
  if (vectors.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: got ${vectors.length} for ${texts.length} inputs`,
    );
  }
  return vectors;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  return v;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

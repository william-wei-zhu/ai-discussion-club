import { cosine } from "@/lib/embeddings";
import type { Intent } from "@/lib/types";

// The defining choice: match on COMPLEMENTARITY, not similarity.
// Mutual benefit = how well my asks meet your offers, AND your asks meet mine.

// Best match between one ask and a set of offers (max cosine).
function bestAgainst(askEmbedding: number[], offers: Intent[]): number {
  let best = 0;
  for (const o of offers) {
    if (!o.active) continue;
    const s = cosine(askEmbedding, o.embedding);
    if (s > best) best = s;
  }
  return best;
}

// One direction: how well A's asks are served by B's offers (averaged over A's asks).
export function directionalFit(aAsks: Intent[], bOffers: Intent[]): number {
  const asks = aAsks.filter((a) => a.active);
  if (asks.length === 0 || bOffers.length === 0) return 0;
  let sum = 0;
  for (const ask of asks) sum += bestAgainst(ask.embedding, bOffers);
  return sum / asks.length;
}

export interface MutualScore {
  aGetsFromB: number; // A's asks met by B's offers
  bGetsFromA: number; // B's asks met by A's offers
  score: number; // sum (the combined lift)
  balance: number; // 1 = perfectly mutual, 0 = one-sided
}

// The bipartite, mutual score: sim(A.ask, B.offer) + sim(B.ask, A.offer).
export function mutualScore(
  aAsks: Intent[],
  aOffers: Intent[],
  bAsks: Intent[],
  bOffers: Intent[],
): MutualScore {
  const aGetsFromB = directionalFit(aAsks, bOffers);
  const bGetsFromA = directionalFit(bAsks, aOffers);
  const score = aGetsFromB + bGetsFromA;
  const max = Math.max(aGetsFromB, bGetsFromA);
  const min = Math.min(aGetsFromB, bGetsFromA);
  const balance = max === 0 ? 0 : min / max;
  return { aGetsFromB, bGetsFromA, score, balance };
}

"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { CopyLine } from "./copy-line";

// "Ask Claude to build something" is the step where a beginner has to supply
// their own idea, and a blank page is where people freeze. So: type your own,
// or roll one of the pre-picked ideas, and the prompt assembles itself
// underneath ready to copy. Every listed idea is deliberately something Claude
// finishes in one go, since the point of this step is a working thing on screen,
// not an ambitious project that stalls.
export function IdeaPicker({ ideas }: { ideas: string[] }) {
  const [idea, setIdea] = useState(ideas[0] ?? "");

  function roll() {
    if (ideas.length < 2) return;
    const others = ideas.filter((i) => i !== idea);
    setIdea(others[Math.floor(Math.random() * others.length)]!);
  }

  const trimmed = idea.trim();
  const prompt = `help me build ${trimmed || "..."}`;

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor="workshop-idea"
        className="kicker block"
      >
        what do you want to build?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="workshop-idea"
          value={idea}
          maxLength={120}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="a birthday countdown page"
          className="h-12 min-w-0 flex-1 rounded-full border-2 border-input bg-background px-5 text-[length:var(--ws-body,1.15rem)] text-foreground outline-none placeholder:text-foreground/45 focus-visible:border-primary"
        />
        <button
          type="button"
          onClick={roll}
          className="button secondary shrink-0 !text-[length:var(--ws-small,0.95rem)]"
        >
          <Dices className="h-5 w-5" />
          Surprise me
        </button>
      </div>
      <CopyLine text={prompt} />
    </div>
  );
}

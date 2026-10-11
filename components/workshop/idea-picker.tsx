"use client";

import { useId, useState } from "react";
import { Dices } from "lucide-react";
import { CopyLine } from "./copy-line";

// "Ask Claude to build something" is the step where a beginner has to supply
// their own idea, and a blank page is where people freeze. So: type your own,
// or roll one of the pre-picked ideas, and the prompt assembles itself
// underneath ready to copy. Every listed idea is deliberately something Claude
// finishes in one go, since the point of this step is a working thing on screen,
// not an ambitious project that stalls.
//
// `prompt` reuses the same box for other fill-in prompts (the Exa deck's "who
// do you want to reach?"). Without a roll list there is no Surprise me button.
const BUILD_PROMPT = {
  label: "what do you want to build?",
  placeholder: "a birthday countdown page",
  template: "help me build {idea}",
};

export function IdeaPicker({
  ideas,
  label,
  prompt = BUILD_PROMPT,
}: {
  ideas: string[];
  label?: string;
  prompt?: { label: string; placeholder: string; template: string };
}) {
  const [idea, setIdea] = useState(ideas[0] ?? "");
  const id = useId();

  function roll() {
    if (ideas.length < 2) return;
    const others = ideas.filter((i) => i !== idea);
    setIdea(others[Math.floor(Math.random() * others.length)]!);
  }

  const trimmed = idea.trim();
  const line = prompt.template.replace("{idea}", trimmed || "...");

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={id}
        className="kicker block"
      >
        {prompt.label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          value={idea}
          maxLength={120}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={prompt.placeholder}
          className="h-12 min-w-0 flex-1 rounded-full border-2 border-input bg-background px-5 text-[length:var(--ws-body,1.15rem)] text-foreground outline-none placeholder:text-foreground/45 focus-visible:border-primary"
        />
        {ideas.length > 1 ? (
          <button
            type="button"
            onClick={roll}
            className="button secondary shrink-0 !text-[length:var(--ws-small,0.95rem)]"
          >
            <Dices className="h-5 w-5" />
            Surprise me
          </button>
        ) : null}
      </div>
      <CopyLine text={line} label={label} />
    </div>
  );
}

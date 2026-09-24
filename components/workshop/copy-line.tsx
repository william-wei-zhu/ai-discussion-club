"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// A big "type this" box with an equally big Copy button. Built for the workshop,
// where someone who has never used a code editor has to get a sentence into a
// chat box exactly right. Copying beats typing, so the button is impossible to
// miss and the text stays large enough to read across a room.
export function CopyLine({
  text,
  label = "type this to Claude",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No toast library on this site, so say it inline, right under the text.
      setFailed(true);
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border-2 border-primary bg-background",
        className,
      )}
    >
      <div className="border-b border-border bg-tint px-4 py-2">
        <span className="kicker">{label}</span>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
        {/* Inside a workshop slide these vars scale with the viewport; anywhere
            else they fall back to the fixed sizes set on `.ws-slide`. */}
        <p className="min-w-0 flex-1 break-words text-[length:var(--ws-body,1.15rem)] leading-relaxed text-foreground">
          {text}
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : `Copy: ${text}`}
          className="button shrink-0 !text-[length:var(--ws-body,1.15rem)] sm:px-7"
        >
          {copied ? (
            <>
              <Check className="h-5 w-5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-5 w-5" /> Copy
            </>
          )}
        </button>
      </div>
      {failed ? (
        <p role="status" className="form-status error px-4 pb-4 !mt-0">
          Could not copy. Select the text and copy it by hand.
        </p>
      ) : null}
    </div>
  );
}

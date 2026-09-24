"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ExternalLink,
  Maximize2,
  Minimize2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CopyLine } from "./copy-line";
import { IdeaPicker } from "./idea-picker";
import { WorkshopSubmitForm } from "./submit-form";
import type { WorkshopStep } from "@/lib/workshops/types";

// The tutorial as a slide deck. A step is not a page: at `lg` and up each one is
// a landscape stage sized to the viewport, picture and aside on the left,
// instruction on the right, so a room follows along without anyone scrolling.
// Type scales with viewport height (see `.ws-slide` in globals.css), the nav
// sits outside the scrollable region so Next can never be pushed out of reach,
// and a fullscreen toggle hands the whole screen to the slide for projecting.
//
// Below `lg` this all falls away and the steps stack and scroll normally.
//
// Every step stays mounted and inactive ones are just `hidden`, which keeps
// Ctrl+F, printing, and crawlers seeing the whole tutorial while the reader only
// ever faces one thing.
//
// Shared by every workshop: each one passes its own steps and its own progress
// key, so two decks never resume each other's position.
export function WorkshopWizard({
  workshop,
  steps,
  storageKey,
}: {
  workshop: string;
  steps: WorkshopStep[];
  storageKey: string;
}) {
  const [index, setIndex] = useState(0);
  const [restored, setRestored] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const scrubbing = useRef(false);
  const total = steps.length;

  // Where to open. A shared ?step=N link wins (so a link to step 14 lands on
  // step 14 for anyone, whatever they last viewed); otherwise pick up where they
  // left off. Effect rather than lazy init so the server and first client render
  // agree. N is 1-indexed in the URL, to match the "step N of total" the reader
  // sees.
  useEffect(() => {
    let target: number | null = null;
    try {
      const n = Number(new URLSearchParams(window.location.search).get("step"));
      if (Number.isInteger(n) && n >= 1 && n <= total) target = n - 1;
    } catch {
      // No usable ?step. Fall back to stored progress.
    }
    if (target === null) {
      try {
        const saved = Number(localStorage.getItem(storageKey));
        if (Number.isInteger(saved) && saved > 0 && saved < total) target = saved;
      } catch {
        // No stored progress. Start at the beginning.
      }
    }
    if (target !== null) setIndex(target);
    setRestored(true);
  }, [total, storageKey]);

  // Keep both the stored progress and the URL in step with the current slide, so
  // the address bar is always a shareable deep link to exactly what is on screen.
  // replaceState, not push, so the Back button is not buried under 20 entries.
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(storageKey, String(index));
    } catch {
      // Private mode. Progress just will not survive a reload.
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("step", String(index + 1));
      window.history.replaceState(null, "", url);
    } catch {
      // No history access. Deep links still work on load, they just will not
      // update live as the reader moves.
    }
  }, [index, restored, storageKey]);

  const go = useCallback(
    (next: number) => {
      setIndex((cur) => {
        const clamped = Math.min(Math.max(next, 0), total - 1);
        if (clamped === cur) return cur;
        // Slides fit the viewport at lg, but the stacked mobile layout scrolls,
        // so reset the scroll position on the way in.
        window.scrollTo({ top: 0, behavior: "smooth" });
        // preventScroll matters: a plain focus() scrolls the heading into view
        // and would undo that.
        requestAnimationFrame(() =>
          headingRef.current?.focus({ preventScroll: true }),
        );
        return clamped;
      });
    },
    [total],
  );

  // Scrub the progress bar like a video timeline: click or drag anywhere on it
  // to jump straight to that step, forward or back, instead of tapping Next.
  const stepFromPointer = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return null;
      const ratio = (clientX - rect.left) / rect.width;
      // Inverse of the fill's (index+1)/total, so the handle lands under the
      // cursor. go() clamps the ends.
      return Math.round(Math.min(Math.max(ratio, 0), 1) * total - 1);
    },
    [total],
  );

  const onBarPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = stepFromPointer(e.clientX);
      if (s === null) return;
      scrubbing.current = true;
      go(s);
      // Capture so a drag keeps tracking even past the bar's edges. Best effort:
      // if the environment rejects it, the click jump above still happened.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // No pointer capture. Drag past the edge just will not track.
      }
    },
    [go, stepFromPointer],
  );

  const onBarPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbing.current) return;
      const s = stepFromPointer(e.clientX);
      if (s !== null) go(s);
    },
    [go, stepFromPointer],
  );

  const onBarPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    scrubbing.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may already be gone. Nothing to do.
    }
  }, []);

  // Arrow keys and Space page through, the way a presenter expects. Typing in
  // the submit box on the last slide must not jump, so fields opt out.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (typing) return;
      const isButton = el?.tagName === "BUTTON" || el?.tagName === "A";
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
      else if (e.key === " " && !isButton) {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "Enter" && !isButton) go(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, total]);

  // Size the stage to whatever the header actually is, rather than a guessed
  // constant, and drop the footer while the deck is up. Together those make the
  // page exactly one viewport tall, so there is no scrollbar to tempt anyone.
  useEffect(() => {
    document.body.classList.add("ws-deck");
    const header = document.querySelector("header");
    if (header) {
      stageRef.current?.style.setProperty(
        "--ws-chrome",
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
    }
    return () => document.body.classList.remove("ws-deck");
  }, []);

  // Track fullscreen from the document, so the Escape key (which the browser
  // handles itself) still flips our icon back.
  useEffect(() => {
    function onChange() {
      setIsFull(document.fullscreenElement === stageRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    // Both calls reject if the browser withholds it (no user activation, or a
    // policy block). Nothing to recover, so swallow it rather than throw an
    // unhandled rejection into the console mid-workshop.
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else stageRef.current?.requestFullscreen?.().catch(() => {});
  }

  const step = steps[index];
  const pct = Math.round(((index + 1) / total) * 100);

  return (
    <div
      ref={stageRef}
      className="ws-slide wrap pb-16 lg:flex lg:h-[calc(100dvh-var(--ws-chrome,6.6rem))] lg:flex-col lg:overflow-hidden lg:pb-0"
    >
      {/* Where am I, how much is left */}
      <div className="shrink-0 py-3 lg:py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="flex items-center gap-4">
            <Link href="/workshops" className="text-link inline-flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4 shrink-0" />
              All workshops
            </Link>
            <span className="kicker">
              step {index + 1} of {total}
            </span>
          </span>
          <span className="flex items-center gap-4">
            {/* Twenty clicks to get home is not navigation. One tap from any
                slide, on every screen size (unlike the fullscreen toggle). */}
            {index > 0 ? (
              <button
                type="button"
                onClick={() => go(0)}
                // A third tone on purpose: Next is a filled purple pill and Back
                // an outlined one, so jumping to the very start gets a lavender
                // chip rather than reading as either of them.
                className="kicker inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-4 py-2 !text-foreground transition-colors hover:border-primary"
              >
                <ChevronsLeft className="h-4 w-4 shrink-0" />
                back to start
              </button>
            ) : null}
            <span className="kicker hidden !text-foreground md:inline">
              {step.part}
            </span>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFull ? "Leave full screen" : "Show full screen"}
              title={isFull ? "Leave full screen" : "Show full screen"}
              className="hidden rounded-md p-1 text-muted-foreground transition-colors hover:text-primary lg:inline-flex"
            >
              {isFull ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </button>
          </span>
        </div>
        {/* Draggable like a video timeline: click or drag anywhere to jump to
            that step. The -my-2 py-2 gives a taller hit area than the thin bar,
            and touch-none keeps a drag from scrolling the page on mobile. */}
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuetext={`step ${index + 1} of ${total}`}
          aria-label="Jump to a step"
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
          onPointerCancel={onBarPointerUp}
          className="group relative mt-2 -my-2 cursor-pointer touch-none select-none py-2 outline-none"
        >
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary transition-[height] group-hover:h-2.5 group-focus-visible:h-2.5">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150 motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* The handle: always visible so the bar reads as draggable, and grows
              a touch on hover/focus. */}
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card shadow-sm transition-transform group-hover:scale-125 group-focus-visible:scale-125"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>

      {steps.map((s, i) => (
        <StepPanel
          key={s.id}
          step={s}
          index={i}
          active={i === index}
          isLast={i === total - 1}
          headingRef={i === index ? headingRef : undefined}
          workshop={workshop}
          onNext={() => go(i + 1)}
          onBack={() => go(i - 1)}
        />
      ))}
    </div>
  );
}

function StepPanel({
  step,
  index,
  active,
  isLast,
  headingRef,
  workshop,
  onNext,
  onBack,
}: {
  step: WorkshopStep;
  index: number;
  active: boolean;
  isLast: boolean;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  workshop: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const media = step.image || step.art ? true : false;
  // A step with nothing to show on the left (or one marked `wide`) runs as one
  // centred column instead.
  const twoUp = media && !step.wide;
  const Heading = index === 0 ? "h1" : "h2";

  return (
    <section
      hidden={!active}
      aria-hidden={!active}
      className={cn(
        active ? "min-h-0 flex-1 lg:grid" : "hidden",
        // Columns stretch to the full row height on purpose: `items-center`
        // would leave the row auto-height, and percentage heights inside it
        // (which is how the picture shrinks to fit) would collapse to auto.
        // Vertical centring comes from `justify-center` within each column.
        twoUp
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-stretch lg:gap-10 xl:gap-14"
          : "lg:grid-cols-1 lg:place-items-center",
      )}
    >
      {/* Left: the picture, its caption, and the secondary aside. Secondary by
          design, which is what keeps the instruction column short enough. */}
      {twoUp ? (
        <div className="flex flex-col justify-center gap-3 lg:min-h-0 lg:max-h-full lg:overflow-hidden">
          {/* The picture takes whatever height is left after the caption and the
              aside, rather than a fixed slice of the viewport. Otherwise the one
              portrait screenshot (816x874) pushes them off the bottom. It is
              never scaled past its natural size, so a small screenshot stays
              sharp instead of blowing up blurry. */}
          {step.image ? (
            <figure className="flex flex-col gap-2 lg:min-h-0 lg:flex-1">
              <div className="flex items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-card p-2 sm:p-3 lg:min-h-0 lg:flex-1">
                <Image
                  src={step.image.src}
                  alt={step.image.alt}
                  width={step.image.width}
                  height={step.image.height}
                  sizes="(max-width: 1024px) 100vw, 600px"
                  // On a slide the picture fills its box exactly and letterboxes
                  // inside it. A flex item's default `min-width: auto` is the
                  // intrinsic width, so a max-width alone would leave the tall
                  // screenshot at full size and the box would crop it.
                  // Stacked (mobile), a portrait screenshot at full width would
                  // make the step absurdly long to scroll, so cap it there too.
                  className="ws-img mx-auto w-full rounded-xl object-contain lg:min-h-0 lg:min-w-0"
                  priority={active}
                />
              </div>
              {step.image.caption ? (
                <figcaption className="shrink-0 text-[length:var(--ws-small)] leading-relaxed text-muted-foreground">
                  {step.image.caption}
                </figcaption>
              ) : null}
            </figure>
          ) : null}

          {step.art ? (
            <div className="flex items-center justify-center lg:min-h-0 lg:flex-1 [&>svg]:lg:max-h-full">
              {step.art}
            </div>
          ) : null}

          {step.note ? (
            <div className="shrink-0 rounded-2xl bg-secondary px-5 py-4">
              <p className="text-[length:var(--ws-small)] leading-relaxed text-foreground">
                {step.note}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Right: what to actually do, with the nav pinned below it. */}
      <div
        className={cn(
          "flex min-h-0 flex-col justify-center gap-[var(--ws-gap)] lg:max-h-full",
          !twoUp && "w-full lg:max-w-3xl",
        )}
      >
        <div className="flex min-h-0 flex-col gap-[var(--ws-gap)] overflow-y-auto lg:pr-2">
          {index === 0 ? (
            <p className="kicker">AI Discussion Club workshop</p>
          ) : null}

          <Heading
            ref={headingRef}
            tabIndex={-1}
            className="ws-title outline-none"
          >
            {step.title}
          </Heading>

          {step.lines.map((line) => (
            <p
              key={line.slice(0, 24)}
              className="text-[length:var(--ws-body)] leading-relaxed text-foreground"
            >
              {line}
            </p>
          ))}

          {/* Buttons live with the instruction they belong to, in the reading
              column. Under the picture they were too easy to miss. */}
          {step.links ? <LinkRow links={step.links} /> : null}

          {step.bullets ? (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {step.bullets.map((b, i) => {
                const text = typeof b === "string" ? b : b.text;
                const link = typeof b === "string" ? null : b.link;
                return (
                  <li
                    key={text.slice(0, 24)}
                    className="flex gap-3 text-[length:var(--ws-body)] leading-relaxed text-foreground"
                  >
                    <span className="shrink-0 font-bold text-primary tabular-nums">
                      {i + 1}.
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span>{text}</span>
                      {/* Sits on the line it belongs to, rather than in the row
                          under the picture, when missing it would cost real
                          money (the free credit). */}
                      {link ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button ws-inline-link"
                        >
                          {link.label}
                          <ExternalLink className="h-4 w-4 shrink-0" />
                        </a>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {step.ideas ? <IdeaPicker ideas={step.ideas} /> : null}

          {step.copy ? (
            <CopyLine text={step.copy.text} label={step.copy.label} />
          ) : null}

          {!twoUp && step.note ? (
            <div className="rounded-2xl bg-secondary px-5 py-4">
              <p className="text-[length:var(--ws-small)] leading-relaxed text-foreground">
                {step.note}
              </p>
            </div>
          ) : null}

          {step.submit ? <WorkshopSubmitForm workshop={workshop} /> : null}
        </div>

        {/* Outside the scroll area, so it is always reachable. Back sits left of
            Next as the club's outlined pill, Next is the filled purple one, so
            forward and back never read as the same button. */}
        <div className="ws-nav flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          {index > 0 ? (
            <button type="button" onClick={onBack} className="button secondary">
              <ArrowLeft className="h-5 w-5" />
              Back
            </button>
          ) : null}
          {!isLast ? (
            <button type="button" onClick={onNext} className="button">
              {index === 0 ? "Start" : "Next"}
              <ArrowRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>

      </div>
    </section>
  );
}

// "Open the site" buttons, rendered directly under the line that tells you to
// go there, so the instruction and the way to act on it stay together.
function LinkRow({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2.5">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="button secondary ws-link"
        >
          {l.label}
          <ExternalLink className="h-4 w-4 shrink-0" />
        </a>
      ))}
    </div>
  );
}

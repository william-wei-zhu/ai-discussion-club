// Hand-drawn mockups for the workshop steps that have no real screenshot, so
// every step gets something to look at. All of them are plain SVG built from
// brand tokens and currentColor, so they follow light/dark without a second
// asset. Deliberately loose and diagrammatic: they show what to look for, they
// are not pretending to be photographs of the real thing.
//
// AiBuildClubArt is the one exception: a real raster logo, framed for the
// "go further" call-to-action slide.

import Image from "next/image";

const frame = "h-auto w-full max-w-xl";

// Shared chrome: the three-dot title bar every browser and editor mockup sits in.
function WindowChrome({ label }: { label?: string }) {
  return (
    <>
      <rect
        x="1"
        y="1"
        width="398"
        height="238"
        rx="10"
        className="fill-card stroke-border"
        strokeWidth="2"
      />
      <path
        d="M1 31h398"
        className="stroke-border"
        strokeWidth="2"
      />
      <circle cx="22" cy="16" r="4.5" className="fill-primary" />
      <circle cx="38" cy="16" r="4.5" className="fill-border" />
      <circle cx="54" cy="16" r="4.5" className="fill-border" />
      {label ? (
        <text
          x="80"
          y="21"
          className="fill-muted-foreground"
          fontSize="11"
          fontFamily="ui-monospace, monospace"
        >
          {label}
        </text>
      ) : null}
    </>
  );
}

// A folder sitting on a desktop, for the "make a folder called claude-workspace"
// step. The one step that happens outside any program.
export function FolderArt({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 400 240" className={frame} role="img" aria-label={`A folder named ${name} on a computer desktop`}>
      <rect x="1" y="1" width="398" height="238" rx="10" className="fill-secondary stroke-border" strokeWidth="2" />
      <path
        d="M148 84h44l12 16h48a8 8 0 0 1 8 8v56a8 8 0 0 1-8 8h-104a8 8 0 0 1-8-8v-72a8 8 0 0 1 8-8z"
        className="fill-tint stroke-primary"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text
        x="200"
        y="192"
        textAnchor="middle"
        className="fill-foreground"
        fontSize="15"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
      >
        {name}
      </text>
    </svg>
  );
}

// A chat exchange: you ask in plain English, Claude gets to work. Used for the
// "now ask it to build something" step and the two publish/save steps.
export function ChatArt({ ask, reply }: { ask: string; reply: string }) {
  return (
    <svg viewBox="0 0 400 240" className={frame} role="img" aria-label={`A chat where you type "${ask}" and Claude replies`}>
      <WindowChrome label="claude" />
      <rect x="120" y="52" width="252" height="46" rx="10" className="fill-primary" />
      <text
        x="136"
        y="80"
        className="fill-[var(--primary-foreground)]"
        fontSize="12"
        fontFamily="ui-monospace, monospace"
      >
        {ask}
      </text>
      <rect x="28" y="116" width="264" height="46" rx="10" className="fill-secondary stroke-border" strokeWidth="2" />
      <text
        x="44"
        y="144"
        className="fill-foreground"
        fontSize="12"
        fontFamily="ui-monospace, monospace"
      >
        {reply}
      </text>
      <rect x="28" y="182" width="344" height="34" rx="8" className="fill-card stroke-primary" strokeWidth="2" />
      <text
        x="44"
        y="204"
        className="fill-muted-foreground/60"
        fontSize="12"
        fontFamily="ui-monospace, monospace"
      >
        type here...
      </text>
    </svg>
  );
}

// A finished app with a shareable address, for the "you are live" step.
export function LiveLinkArt() {
  return (
    <svg viewBox="0 0 400 240" className={frame} role="img" aria-label="A browser showing your published app at its own web address">
      <WindowChrome />
      <rect x="76" y="8" width="240" height="17" rx="8" className="fill-secondary stroke-border" strokeWidth="1.5" />
      <text
        x="196"
        y="21"
        textAnchor="middle"
        className="fill-primary"
        fontSize="10"
        fontFamily="ui-monospace, monospace"
      >
        your-app.vercel.app
      </text>
      <rect x="40" y="56" width="320" height="150" rx="8" className="fill-tint stroke-primary" strokeWidth="2" />
      <text
        x="200"
        y="128"
        textAnchor="middle"
        className="fill-primary"
        fontSize="17"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
      >
        your app, live
      </text>
      <text
        x="200"
        y="152"
        textAnchor="middle"
        className="fill-foreground"
        fontSize="11"
        fontFamily="ui-monospace, monospace"
      >
        anyone with the link can open it
      </text>
    </svg>
  );
}

// A stack of saved versions, for the GitHub backup step.
export function BackupArt() {
  return (
    <svg viewBox="0 0 400 240" className={frame} role="img" aria-label="Three saved copies of your project stacked up as backups">
      <rect x="1" y="1" width="398" height="238" rx="10" className="fill-secondary stroke-border" strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={90 + i * 14}
            y={62 + i * 34}
            width="200"
            height="44"
            rx="8"
            className="fill-card stroke-border"
            strokeWidth="2"
          />
          <circle cx={112 + i * 14} cy={84 + i * 34} r="6" className="fill-primary" />
          <rect
            x={128 + i * 14}
            y={78 + i * 34}
            width={120 - i * 18}
            height="10"
            rx="5"
            className="fill-muted-foreground/25"
          />
        </g>
      ))}
      <text
        x="200"
        y="212"
        textAnchor="middle"
        className="fill-muted-foreground"
        fontSize="12"
        fontFamily="ui-monospace, monospace"
      >
        every version, kept safe
      </text>
    </svg>
  );
}

// Dropping your own material into the folder so Claude can read it.
export function ContextFilesArt() {
  return (
    <svg viewBox="0 0 400 240" className={frame} role="img" aria-label="Files being dragged into your project folder">
      <rect x="1" y="1" width="398" height="238" rx="10" className="fill-secondary stroke-border" strokeWidth="2" />
      {[0, 1].map((i) => (
        <g key={i}>
          <rect
            x={44 + i * 46}
            y={54 + i * 18}
            width="56"
            height="70"
            rx="6"
            className="fill-card stroke-border"
            strokeWidth="2"
          />
          <rect x={54 + i * 46} y={70 + i * 18} width="36" height="7" rx="3.5" className="fill-muted-foreground/25" />
          <rect x={54 + i * 46} y={84 + i * 18} width="28" height="7" rx="3.5" className="fill-muted-foreground/20" />
          <rect x={54 + i * 46} y={98 + i * 18} width="32" height="7" rx="3.5" className="fill-muted-foreground/20" />
        </g>
      ))}
      <path
        d="M170 118h56"
        className="stroke-primary"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="m214 108 14 10-14 10"
        className="stroke-primary"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M244 84h34l10 13h58a7 7 0 0 1 7 7v46a7 7 0 0 1-7 7h-102a7 7 0 0 1-7-7v-59a7 7 0 0 1 7-7z"
        className="fill-tint stroke-primary"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text
        x="300"
        y="184"
        textAnchor="middle"
        className="fill-foreground"
        fontSize="12"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
      >
        claude-workspace
      </text>
    </svg>
  );
}

// The AI Build Club logo, framed for the "go further" slide. The logo is a bold
// dark square, so it sits in a rounded frame with a soft purple glow behind it
// rather than the plain light card the screenshots use. Height-constrained so it
// fits the slide's picture column without pushing the nav off screen.
export function AiBuildClubArt() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative w-full max-w-[22rem] lg:max-h-full lg:w-auto">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-4 rounded-[2.5rem] bg-primary/25 blur-3xl"
        />
        <Image
          src="/workshops/claude/ai-build-club.png"
          alt="AI Build Club"
          width={1254}
          height={1254}
          sizes="(max-width: 1024px) 100vw, 400px"
          className="relative mx-auto h-auto w-full rounded-3xl shadow-2xl ring-1 ring-foreground/10 lg:h-full lg:max-h-full lg:w-auto lg:object-contain"
        />
      </div>
    </div>
  );
}

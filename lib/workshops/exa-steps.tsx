import { ScreenshotPlaceholder } from "@/components/workshop/workshop-art";
import type { WorkshopStep } from "./types";

// The outreach deck: connect Claude or ChatGPT to Exa, then do two jobs.
// Job 1 researches one person and writes them a message. Job 2 turns that into
// a list and works through it. Built for a 45-minute room, so it is short and
// nothing is installed beyond the Exa connector.
//
// One deck serves both assistants. Only "Add Exa" differs, and it gives both
// paths. Every prompt is plain English that works in either app.
//
// Exa signs people in when they add it, so searches bill to their own Exa
// account. That is why the $50 code (redeemed on the Billing page) matters.
//
// Screenshots still to come from the owner, shown as ScreenshotPlaceholder:
// the cover (public/workshops/exa/title-cover.png is a stand-in), the Exa
// Billing page, ChatGPT's Exa plugin page, a checked message, and the result
// table. Swap each `art` for an `image` block as they arrive, under
// public/workshops/exa/.

export const EXA_STEPS: WorkshopStep[] = [
  {
    id: "welcome",
    part: "before you start",
    title: "Reach the right people with Exa",
    lines: [
      "Researching one person well can take 20 minutes. Today Exa does the digging, so you can write to people the way they deserve.",
      "You will do two jobs: research one person and write them a message they want to answer, then build a list of the right people and work through it.",
      "Set aside about 45 minutes and use a laptop. Claude or ChatGPT both work.",
    ],
    image: {
      src: "/workshops/exa/title-cover.png",
      width: 1254,
      height: 1254,
      alt: "Reach the right people with Exa, a workshop with Claude or ChatGPT",
    },
  },

  {
    id: "get-assistant",
    part: "set up",
    title: "Open Claude or ChatGPT",
    lines: [
      "Use whichever one you already have. Sign in on the website or in the desktop app.",
      "Either one works for everything today. Where the steps differ, this guide shows both.",
    ],
    links: [
      { href: "https://claude.ai/", label: "Open claude.ai" },
      { href: "https://chatgpt.com/", label: "Open chatgpt.com" },
    ],
    art: <ScreenshotPlaceholder label="Claude and ChatGPT side by side" />,
  },
  {
    id: "exa-account",
    part: "set up",
    title: "Get Exa and your $50 credit",
    lines: [
      "Exa is a search engine built for AI. It finds people and pages that normal search misses.",
    ],
    bullets: [
      {
        text: "Make a free account at dashboard.exa.ai.",
        link: { href: "https://dashboard.exa.ai/", label: "Open dashboard.exa.ai" },
      },
      {
        text: "Open the Billing page.",
        link: { href: "https://dashboard.exa.ai/billing", label: "Open Billing" },
      },
      "Find the box for a coupon code, paste the code below, and redeem it.",
    ],
    copy: { text: "EXA50DCSTARTUP", label: "your $50 code" },
    art: <ScreenshotPlaceholder label="The Exa Billing page, with the coupon box" />,
    note: "Every attendee gets $50 of Exa credit. It stays on your account after today.",
  },
  {
    id: "add-exa",
    part: "set up",
    title: "Add Exa to your assistant",
    lines: [
      "Follow the path for the app you use. When it asks you to sign in to Exa, use the account you just made.",
    ],
    bullets: [
      "Claude: click the + in the chat box, choose Add connectors, search exa, and click the plus.",
      {
        text: "ChatGPT: open the Exa page in the plugin directory and click the plus.",
        link: { href: "https://chatgpt.com/plugins/exa", label: "Open Exa for ChatGPT" },
      },
      "Start a new chat, so Exa is switched on.",
    ],
    image: {
      src: "/workshops/claude/exa-connector.png",
      width: 1080,
      height: 676,
      alt: "Claude's Connectors directory with exa typed in the search box and the Exa result added",
      caption: "In Claude: search exa, then click the plus.",
    },
    art: <ScreenshotPlaceholder label="Exa in ChatGPT's plugin directory" />,
  },

  {
    id: "research-person",
    part: "job 1: reach one person",
    title: "Research one person",
    lines: [
      "Pick someone you actually want to reach: an investor, a customer, a partner.",
      "Type their name and where they work. Then copy the line and paste it into your chat.",
    ],
    idea: {
      label: "who do you want to reach?",
      placeholder: "their name, and where they work",
      template:
        "use exa to research {idea}. what do they care about right now? look for posts, talks, interviews and news from the last 3 months. give me 5 specific things, each with a link.",
    },
    art: <ScreenshotPlaceholder label="The research answer, five things with links" />,
    note: "If Exa finds the wrong person, add a detail, like their city or job title.",
  },
  {
    id: "write-message",
    part: "job 1: reach one person",
    title: "Write a message they want to answer",
    lines: [
      "Stay in the same chat, so it remembers the research.",
      "Say who you are and what you want from them. The line below does the rest.",
    ],
    idea: {
      label: "who are you, and what are you asking for?",
      placeholder: "a founder looking for a 20 minute call",
      template:
        "using that research, write them a short message, under 100 words. open with one specific thing they did or said recently. i am {idea}. end with one easy question. no flattery, no buzzwords.",
    },
    art: <ScreenshotPlaceholder label="A short message that opens with something specific" />,
  },
  {
    id: "check-it",
    part: "job 1: reach one person",
    title: "Check it before you send",
    lines: [
      "AI can get a detail wrong, and a wrong detail is worse than none.",
    ],
    bullets: [
      "Click two of the links and make sure the facts are real.",
      "Change at least one sentence so it sounds like you.",
      "Send it from your own email or LinkedIn.",
    ],
    art: <ScreenshotPlaceholder label="A message with its facts checked against the links" />,
    note: "That is job 1. Most people stop at one message a week. Job 2 is how you do twenty.",
  },

  {
    id: "find-list",
    part: "job 2: build a pipeline",
    title: "Build a list of the right people",
    lines: [
      "Describe who you are looking for, or roll an example. Then copy the line into your chat.",
      "The more specific you are, the better the list.",
    ],
    ideas: [
      "seed investors who back climate startups",
      "HR leaders at mid-size companies in DC",
      "founders of small fintech startups",
      "partnership leads at nonprofits",
      "angel investors in health tech",
      "operations managers at restaurant groups",
      "professors who research AI in education",
    ],
    idea: {
      label: "who are you looking for?",
      placeholder: "seed investors who back climate startups",
      template:
        "use exa to find 15 {idea}. for each one give their name, role, company, a link, and one recent thing they said or did. put it in a table.",
    },
    art: <ScreenshotPlaceholder label="A table of 15 people with links" />,
  },
  {
    id: "work-list",
    part: "job 2: build a pipeline",
    title: "Work through it, one person at a time",
    lines: [
      "A list is only useful if every message still feels personal. Let the AI sort the list, then write each one from that person's own news.",
    ],
    copy: {
      text: "rank them by how well they fit what i am asking for, with one line on why. then write a message for the top 5, each opening with something specific to that person, like the one we wrote earlier.",
    },
    art: <ScreenshotPlaceholder label="The ranked list with five messages" />,
    note: "Check each one like before. Send a few a day, not all at once.",
  },
  {
    id: "keep-list",
    part: "job 2: build a pipeline",
    title: "Keep your list",
    lines: [
      "Put the list somewhere you will see it again, so you can follow up.",
      "Paste the result into a new Google Sheet. Fill in status as people reply.",
    ],
    copy: {
      text: "turn the table into a csv i can paste into google sheets, with extra columns for status and date contacted.",
    },
    links: [{ href: "https://websets.exa.ai/", label: "Open Exa Websets" }],
    art: <ScreenshotPlaceholder label="The list in a Google Sheet" />,
    note: "Need hundreds of people? Exa Websets builds and checks big lists, and it runs on the same $50 credit.",
  },

  {
    id: "finish",
    part: "the finish line",
    title: "You have a setup and a list",
    lines: [
      "Your assistant now searches with Exa, and it will keep doing that after today.",
      "You have one message ready to send, a list of the right people, and a way to work through it without losing the personal touch.",
      "Come back to the club and tell us who wrote back.",
    ],
    links: [{ href: "https://luma.com/ai-discussion-club", label: "See upcoming events" }],
    wide: true,
  },
];

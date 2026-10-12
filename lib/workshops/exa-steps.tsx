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
// Pictures: the Claude logo (owner-supplied) and the ChatGPT logo from the
// website decks,
// Claude's Exa connector from the Claude deck, and ChatGPT's Exa plugin page
// was captured from the public chatgpt.com/plugins/exa. Steps 3, 5, 6 and 8-10
// are real screenshots: the Exa Billing coupon box (cropped to keep the
// account's balance and card out) and one Claude chat with Exa that runs this
// deck's prompts, researching Darius Clair of DC Startup & Tech Week. Step 7 is
// a generated illustration, since it is generic.

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
      alt: "AI-Powered Growth: Outreach, Pipeline, and Getting Found by AI. DC Startup and Tech Week, Tuesday, October 20, 2026, 9:00 to 9:45 AM ET, MLK Conference Center",
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
    image: [
      {
        src: "/workshops/exa/claude-logo.png",
        width: 1280,
        height: 275,
        alt: "The Claude logo",
        caption: "Claude: the same account you use on claude.ai.",
      },
      {
        src: "/workshops/chatgpt/get-chatgpt.webp",
        width: 800,
        height: 800,
        alt: "The ChatGPT logo above the word ChatGPT",
        caption: "ChatGPT: the same account you use on chatgpt.com.",
      },
    ],
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
    image: {
      src: "/workshops/exa/exa-coupon-box.png",
      width: 900,
      height: 125,
      alt: "The coupon box on the Exa Billing page: Enter coupon code, and a Redeem button",
      caption: "Paste the code into the coupon box, then click Redeem.",
    },
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
        text: "ChatGPT: open the Exa plugin page and click Install plugin.",
        link: { href: "https://chatgpt.com/plugins/exa", label: "Open Exa for ChatGPT" },
      },
      "Start a new chat, so Exa is switched on.",
    ],
    image: [
      {
        src: "/workshops/claude/exa-connector.png",
        width: 1080,
        height: 676,
        alt: "Claude's Connectors directory with exa typed in the search box and the Exa result added",
        caption: "In Claude: search exa, then click the plus.",
      },
      {
        src: "/workshops/exa/chatgpt-exa-plugin-page.png",
        width: 625,
        height: 480,
        alt: "The Exa plugin page in ChatGPT, with the Install plugin button next to the name",
        caption: "In ChatGPT: click Install plugin.",
      },
    ],
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
    image: {
      src: "/workshops/exa/research-answer.png",
      width: 1456,
      height: 718,
      alt: "Claude, using Exa, corrects the person's title and lists what they are working on right now",
      caption: "It searches with Exa and comes back with what they are up to.",
    },
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
    image: {
      src: "/workshops/exa/message-draft.png",
      width: 1568,
      height: 673,
      alt: "A short message that opens with a point from an article the person wrote, then asks for a 20 minute call",
      caption: "A real draft: specific opening, clear ask, one easy question.",
    },
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
    image: {
      src: "/workshops/exa/check-it.jpg",
      width: 1500,
      height: 996,
      alt: "An illustration of someone checking a drafted message with a magnifying glass, with two links ticked",
    },
    note: "In our test, the research corrected our own prompt: the person had a different title than we typed. That is why you check.",
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
      "angel investors in the DC area who back early-stage startups",
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
      placeholder: "angel investors in the DC area",
      template:
        "use exa to find 15 {idea}. for each one give their name, role, company, a link, and one recent thing they said or did. put it in a table.",
    },
    image: {
      src: "/workshops/exa/people-table.png",
      width: 1568,
      height: 701,
      alt: "A table of investors with name, role, company, a link, and a recent thing each one said or did",
      caption: "The first rows of a 15 person table.",
    },
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
    image: {
      src: "/workshops/exa/ranked-list.png",
      width: 1529,
      height: 546,
      alt: "The list ranked by fit, with one line on why each person is a good match",
      caption: "Ranked by fit, each with a reason. The five messages follow below it.",
    },
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
    image: {
      src: "/workshops/exa/list-csv.png",
      width: 1568,
      height: 515,
      alt: "The list as CSV text with columns for rank, name, role, company, link, status and date contacted",
      caption: "Copy it, then paste into cell A1 of a new Google Sheet.",
    },
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

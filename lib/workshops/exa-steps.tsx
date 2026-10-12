import type { WorkshopStep } from "./types";

// The outreach deck: connect Claude or ChatGPT to Exa, then do two jobs.
// Job 1 builds a list of the right people and saves it as a spreadsheet, in
// one prompt. Job 2 enriches all ten rows with Exa (background, recent
// writing, links, needs), writes each of them a message from what they recently
// said, then checks before sending. List first, so every
// message has a place to be tracked. Built for a 45-minute room, so it is short
// and nothing is installed beyond the Exa connector.
//
// One deck serves both assistants. Only "Add Exa" differs, and it gives both
// paths. Every prompt is plain English that works in either app.
//
// Exa signs people in when they add it, so searches bill to their own Exa
// account. That is why the $50 code (redeemed on the Billing page) matters.
//
// Pictures: the Claude logo (owner-supplied, flattened onto white so the black
// wordmark shows in dark mode), the ChatGPT logo from the website deck, the
// owner's screenshots of Claude's Connectors and ChatGPT's Plugins pages
// searched for exa, and the owner-supplied Exa banner. The contact list, the
// enriched table, the message cards and the check are generated illustrations
// with no real people (the Exa logo was passed to Higgsfield as a reference).
// The page passes `bigMedia`, so the text-heavy screenshots get the wider
// column.

export const EXA_STEPS: WorkshopStep[] = [
  {
    id: "welcome",
    part: "before you start",
    title: "Reach the right people with Exa",
    lines: [
      "Researching one person well can take 20 minutes. Today Exa does the digging, so you can write to people the way they deserve.",
      "You will do two jobs: build a list of the right people and save it, then go deep on all ten and write each of them a message they want to answer.",
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
        width: 1400,
        height: 395,
        alt: "The Claude logo",
      },
      {
        src: "/workshops/chatgpt/get-chatgpt.webp",
        width: 800,
        height: 800,
        alt: "The ChatGPT logo above the word ChatGPT",
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
      src: "/workshops/exa/exa-banner.jpg",
      width: 1600,
      height: 1056,
      alt: "Exa: the world's data for AI agents",
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
      {
        text: "Claude: click the + in the chat box, choose Add connectors, search exa, and click the plus.",
        link: { href: "https://claude.ai/directory/exa", label: "Open Exa for Claude" },
      },
      {
        text: "ChatGPT: click the Plugins icon in the left sidebar, search exa, and add it.",
        link: { href: "https://chatgpt.com/plugins/exa", label: "Open Exa for ChatGPT" },
      },
      "Start a new chat, so Exa is switched on.",
    ],
    imagesSideBySide: true,
    image: [
      {
        src: "/workshops/exa/claude-exa-connector.png",
        width: 1362,
        height: 1204,
        alt: "Claude's Connectors directory with exa typed in the search box and the Exa result added",
      },
      {
        src: "/workshops/exa/chatgpt-exa-plugins.png",
        width: 1036,
        height: 590,
        alt: "The Plugins page in the ChatGPT app with exa typed in the search box and the Exa plugin listed",
      },
    ],
  },

  {
    id: "find-list",
    part: "job 1: build your list",
    title: "Find the right people",
    lines: [
      "Describe who you are looking for, or roll an example. Then copy the line into a new chat.",
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
      "pre-seed investors who back first-time founders",
      "venture partners who invest in defense tech",
      "heads of marketing at DC-area startups",
      "owners of independent coffee shops in DC",
      "property managers at apartment buildings in Northern Virginia",
      "school principals interested in AI tools",
      "program directors at startup accelerators on the East Coast",
      "procurement officers at federal contractors",
      "community managers at coworking spaces in DC",
      "chief technology officers at small government tech firms",
      "podcast hosts who interview startup founders",
      "local journalists who cover the DC tech scene",
      "directors of small business development centers",
      "customer success leads at B2B software startups",
      "event organizers who run tech meetups in the DMV",
      "physicians who write about AI in healthcare",
    ],
    idea: {
      label: "who are you looking for?",
      placeholder: "angel investors in the DC area",
      template:
        "use exa to find 10 {idea}. for each one give their name, role, company, a link, and one recent thing they said or did. put it in a table first, then save it as a csv i can paste into google sheets, with extra columns for status and date contacted.",
    },
    image: {
      src: "/workshops/exa/contact-list.jpg",
      width: 1000,
      height: 960,
      alt: "An illustration of a contact list found with Exa: faceless avatars, a link for each person, and a status for each row",
    },
  },
  {
    id: "research-top",
    part: "job 2: reach each person",
    title: "Go deep on all ten",
    lines: [
      "Stay in the same chat and let Exa dig into all ten people on your list.",
      "It adds what it finds as new columns, so your spreadsheet gets richer instead of you juggling tabs.",
    ],
    copy: {
      text: "use exa to go deep on all 10 people on my list. for each person find: their background and education, what they have written, posted or said in the last 3 months (with links), the problems or goals they keep coming back to, and what they might need right now. add these as new columns to the table, then give me the updated csv.",
    },
    image: {
      src: "/workshops/exa/enriched-list.jpg",
      width: 1500,
      height: 996,
      alt: "An illustration of an Exa contact table gaining new columns for background, writing, links and needs",
    },
    note: "If Exa mixes someone up with a person of the same name, tell it their company or city and ask it to redo that row.",
  },
  {
    id: "write-messages",
    part: "job 2: reach each person",
    title: "Write each of them a message",
    lines: [
      "The best opener is something they wrote or said recently, and the problem behind it.",
      "Say who you are and what you can offer. The line below writes ten messages, each from that person's own words, and adds them to your sheet.",
    ],
    idea: {
      label: "who are you, and what can you offer?",
      placeholder: "a founder building an AI tool for small businesses",
      template:
        "for each of those 10 people, pick the most recent thing they wrote or said, name the problem behind it in their words, and write them a short message, under 100 words: open with that piece, offer one concrete way i can help, and end with one easy question. i am {idea}. no flattery, no buzzwords. add the messages as a new column in the csv.",
    },
    image: {
      src: "/workshops/exa/five-messages.jpg",
      width: 1500,
      height: 996,
      alt: "An illustration of five message cards, each starting from a different person's own words",
    },
  },
  {
    id: "check-it",
    part: "job 2: reach each person",
    title: "Check it before you send",
    lines: [
      "AI can get a detail wrong, and a wrong detail is worse than none.",
    ],
    bullets: [
      "For each message, click a link or two and make sure the facts are real.",
      "Change at least one sentence so it sounds like you.",
      "Send from your own email or LinkedIn, a few a day, and mark each one contacted in your sheet.",
    ],
    image: {
      src: "/workshops/exa/check-it.jpg",
      width: 1500,
      height: 996,
      alt: "An illustration of someone checking a drafted message with a magnifying glass, with two links ticked",
    },
    note: "In our first test, the research corrected our own prompt: the person had a different title than we typed. That is why you check.",
  },

  {
    id: "more",
    part: "the finish line",
    title: "Want more?",
    lines: [
      "For more workshops like this one, and our upcoming events, head to the AI Discussion Club homepage.",
    ],
    links: [{ href: "/", label: "Go to AI Discussion Club" }],
    image: {
      src: "/brand/preview.png",
      width: 2299,
      height: 1294,
      alt: "Make DC the City for Innovators: the Washington skyline in cherry blossom season",
    },
  },
];

import type { WorkshopStep } from "./types";

// The outreach deck: connect Claude or ChatGPT to Exa, then do two jobs.
// Job 1 builds a list of the right people and saves it as a spreadsheet, in
// one prompt. Job 2 works down that list: research one person, write a message
// from what they recently said, check it, then repeat. List first, so every
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
// wordmark shows in dark mode), the ChatGPT logo and Claude's Exa connector
// from the website decks, the owner's screenshot of ChatGPT's Plugins page
// searched for exa, and the owner-supplied Exa banner. The research prompt
// and the message are real screenshots of Claude chats with Exa running this deck's prompts (the person researched is Darius
// Clair of DC Startup & Tech Week). The contact list, the check and the
// work-down-the-list pictures are generated illustrations with no real people.
// The page passes `bigMedia`, so the text-heavy screenshots get the wider
// column.

export const EXA_STEPS: WorkshopStep[] = [
  {
    id: "welcome",
    part: "before you start",
    title: "Reach the right people with Exa",
    lines: [
      "Researching one person well can take 20 minutes. Today Exa does the digging, so you can write to people the way they deserve.",
      "You will do two jobs: build a list of the right people and save it, then work down it, writing each person a message they want to answer.",
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
      "Claude: click the + in the chat box, choose Add connectors, search exa, and click the plus.",
      {
        text: "ChatGPT: click the Plugins icon in the left sidebar, search exa, and add it.",
        link: { href: "https://chatgpt.com/plugins/exa", label: "Open Exa for ChatGPT" },
      },
      "Start a new chat, so Exa is switched on.",
    ],
    imagesSideBySide: true,
    image: [
      {
        src: "/workshops/claude/exa-connector.png",
        width: 1080,
        height: 676,
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
      "It finds the people, puts them in a table, and turns the table into a spreadsheet file. Paste that into a new Google Sheet, and fill in status as you go.",
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
        "use exa to find 15 {idea}. for each one give their name, role, company, a link, and one recent thing they said or did. put it in a table first, then save it as a csv i can paste into google sheets, with extra columns for status and date contacted.",
    },
    image: {
      src: "/workshops/exa/contact-list.jpg",
      width: 1000,
      height: 960,
      alt: "An illustration of a contact list found with Exa: faceless avatars, a link for each person, and a status for each row",
    },
    links: [{ href: "https://websets.exa.ai/", label: "Open Exa Websets" }],
    note: "Need hundreds of people? Exa Websets builds and checks big lists, and it runs on the same $50 credit.",
  },
  {
    id: "research-person",
    part: "job 2: reach each person",
    title: "Research the first person",
    lines: [
      "Start at the top of your list. Type their name and their role, then copy the line into your chat.",
    ],
    idea: {
      label: "who is first on your list?",
      placeholder: "their name, and their role",
      template:
        "use exa to research {idea}. what do they care about right now? look for posts, talks, interviews and news from the last 3 months. give me 5 specific things, each with a link.",
    },
    image: {
      src: "/workshops/exa/research-prompt.png",
      width: 1004,
      height: 666,
      alt: "The research prompt typed into the Claude chat box, naming the person and their role",
      caption: "Paste the line in and send it.",
    },
    note: "If Exa finds the wrong person, add a detail, like their city or company.",
  },
  {
    id: "write-message",
    part: "job 2: reach each person",
    title: "Write from what they just said",
    lines: [
      "The best opener is something they wrote or said recently, and the problem behind it. Stay in the same chat, so it remembers the research.",
      "Say who you are and what you can offer. The line below finds the angle where you can help.",
    ],
    idea: {
      label: "who are you, and what can you offer?",
      placeholder: "a founder building an AI tool for small businesses",
      template:
        "from that research, pick the most recent thing they wrote or said. what problem or goal is behind it, and how could someone like me help with it? i am {idea}. then write them a short message, under 100 words: open with that piece, name the problem in their words, offer one concrete way i can help, and end with one easy question. no flattery, no buzzwords.",
    },
    image: {
      src: "/workshops/exa/message-angle.png",
      width: 1568,
      height: 575,
      alt: "A short message that opens with a line the person wrote, names the problem in their words, and offers a free hands-on session",
      caption: "A real draft: their words, their problem, one concrete offer, one easy question.",
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
      "Click two of the links and make sure the facts are real.",
      "Change at least one sentence so it sounds like you.",
      "Send it from your own email or LinkedIn, then mark them contacted in your sheet.",
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
    id: "next-person",
    part: "job 2: reach each person",
    title: "Work down the list",
    lines: [
      "Do the same for the next few people. Each message still starts from that person's own news, so none of them feel copied.",
    ],
    copy: {
      text: "now do the same for the next 4 people on my list. research each one with exa, then write each a message the same way. put each message under their name.",
    },
    image: {
      src: "/workshops/exa/next-person.jpg",
      width: 1500,
      height: 996,
      alt: "An illustration of a contact list with the first two people ticked off and a personal message going out to the third",
    },
    note: "Check each one like before. Send a few a day, not all at once, and update the status column as people reply.",
  },

  {
    id: "finish",
    part: "the finish line",
    title: "You have a list and a way to work it",
    lines: [
      "Your assistant now searches with Exa, and it will keep doing that after today.",
      "You have a list of the right people in a spreadsheet, and a message ready for the first of them that starts from what they care about.",
      "Come back to the club and tell us who wrote back.",
    ],
    links: [{ href: "https://luma.com/ai-discussion-club", label: "See upcoming events" }],
    wide: true,
  },
];

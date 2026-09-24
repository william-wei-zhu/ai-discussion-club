import {
  AiBuildClubArt,
  BackupArt,
  ChatArt,
  ContextFilesArt,
  FolderArt,
  LiveLinkArt,
} from "@/components/workshop/workshop-art";
import type { WorkshopStep } from "./types";

// The Build with Claude 101 tutorial, one idea per screen.
//
// Written for someone who has never built an app before: no jargon survives
// here untranslated (a connector is a plug-in that gives Claude a new skill, a
// CLI is a helper tool Claude uses on your behalf, a repository is a safe
// online backup). Where the original hand-out packed four physical actions
// into one bullet, they are split apart, because a beginner following along
// live loses the thread at exactly those joins.
//
// The whole build happens inside the Claude desktop app: you download the app,
// open Claude Code (the code icon), point it at a folder, and describe what you
// want. There is no separate editor to install.
//
// Ported from the Feedback Lab workshop (feedbacklab.app/workshop). One
// deliberate departure from the usual copy rules, correct here: this page names
// real products (Claude, Vercel, GitHub, Exa, Firebase, PostHog, Feedback Lab,
// AI Build Club) because the product names ARE the instructions rather than
// placeholder examples.

export const CLAUDE_STEPS: WorkshopStep[] = [
  {
    id: "welcome",
    part: "before you start",
    // The title slide: the page itself carries no hero, so it lives here. The
    // cover art on the left carries the "in 2 hours" hook, so the heading states
    // the promise plainly.
    title: "Build your first website",
    lines: [
      "Build your very first web app, one step at a time. You say what you want, and Claude writes the code for you.",
      "By the end you will have something that works, a web address you can send to anyone, and a safe backup of it.",
      "Set aside about 45 minutes. You need a laptop for this one, not a phone.",
    ],
    image: {
      src: "/workshops/claude/title-cover.png",
      width: 1254,
      height: 1254,
      alt: "Build your first website in 2 hours, beginner-friendly, with Claude and Vercel",
    },
  },

  {
    id: "get-claude",
    part: "getting claude onto your computer",
    title: "Get Claude",
    lines: [
      "Claude is the assistant that does the building. Go to claude.ai and make an account.",
      "Choose the paid plan at $20 a month. The free one runs out partway through a project.",
    ],
    links: [{ href: "https://claude.ai/", label: "Open claude.ai" }],
    image: {
      src: "/workshops/claude/get-claude.png",
      width: 1442,
      height: 1150,
      alt: "The Claude sign-up page with Continue with Google and Continue with email options",
      caption: "Sign up with Google, or with your email address.",
    },
  },
  {
    id: "download-claude",
    part: "getting claude onto your computer",
    title: "Download the Claude Desktop app",
    lines: [
      "Claude does all its building right inside the Claude Desktop app on your computer. There is no separate program to install.",
      "Go to the page below and click the download button for your computer. Open the file when it finishes and follow the installer.",
      "Then open the app and sign in with the account you just made.",
    ],
    links: [{ href: "https://claude.ai/download", label: "Open claude.ai/download" }],
    image: {
      src: "/workshops/claude/download-claude.png",
      width: 950,
      height: 908,
      alt: "The Claude download page with a Download for macOS button",
      caption: "The download button.",
    },
  },
  {
    id: "open-claude-code",
    part: "getting claude onto your computer",
    title: "Open Claude Code",
    lines: [
      "Along the top of the Claude app is a small row of icons. Click the one that looks like </>.",
      "That opens Claude Code, the part that builds your app. You are already signed in, so there is nothing else to set up.",
    ],
    image: {
      src: "/workshops/claude/open-claude-code.png",
      width: 614,
      height: 480,
      alt: "The top of the Claude app with the code icon circled",
      caption: "The code icon, circled.",
    },
    note: "Claude Code is the builder that comes with the app. It is where you type what you want and watch Claude make it.",
  },
  {
    id: "make-folder",
    part: "getting claude onto your computer",
    title: "Make a folder for your work",
    lines: [
      "Go to your desktop and make a new folder. Name it claude-workspace.",
      "This is where your app will live. Everything Claude builds goes in here.",
    ],
    note: "On a Mac, right-click the desktop and choose New Folder. On Windows, right-click and choose New, then Folder.",
    art: <FolderArt name="claude-workspace" />,
  },
  {
    id: "pick-folder",
    part: "getting claude onto your computer",
    title: "Point Claude Code at your folder",
    lines: [
      "At the top of the Claude Code box are two small buttons: Local, and No folder.",
      "Click No folder and choose the claude-workspace folder you just made. Now everything Claude builds goes into it.",
    ],
    image: {
      src: "/workshops/claude/pick-folder.png",
      width: 798,
      height: 276,
      alt: "The Claude Code box with the No folder button circled",
      caption: "Click No folder, circled, and pick your folder.",
    },
  },
  {
    id: "build-something",
    part: "getting claude onto your computer",
    title: "Ask Claude to build something",
    lines: [
      "Pick something below, or type your own. Then copy the line and paste it into Claude Code.",
      "Claude writes the files and shows you what it is doing as it goes. It can take a few minutes, so let it finish.",
    ],
    // Each of these is a one-sitting build. A first project needs to finish and
    // work, so nothing here needs rules, accounts, or a second session to see
    // something real on screen.
    ideas: [
      "a birthday countdown page",
      "a tip calculator",
      "a recipe box for my favourite meals",
      "a to-do list that remembers what I typed",
      "a random dinner picker",
      "a photo album for family pictures",
      "a flash card quiz to help me study",
      "a sliding puzzle game",
      "a colour matching memory game",
      "a countdown timer for workouts",
      "a page that tells me how many days until my holiday",
      "a jar of compliments that shows a new one each time",
      "a wheel that spins and picks a name",
      "a grocery list I can tick off",
      "a page that turns my name into fancy fonts",
      "a plant watering reminder chart",
      "a coin flip and dice roller",
      "a page that shows a random fact about cats",
      "a habit tracker with a row of little squares",
      "a tic tac toe game",
      "a page that counts how many books I read this year",
      "a mood tracker where I tap a face each day",
      "a whack a mole game",
      "a page that picks a random movie from my watchlist",
      "a bill splitter for a table of friends",
      "a page that shows my step by step morning routine",
      "a colour palette generator",
      "a stopwatch with lap times",
      "a page that says how old someone is in days",
      "a rock paper scissors game against the computer",
      "a page that shuffles a list of chores between people",
      "a gratitude journal I can add to each night",
      "a typing speed test",
      "a page that shows a countdown to the next school holiday",
      "a simple drawing pad I can save from",
      "a reaction time test",
      "a page that converts cooking measurements",
      "a quiz about my family that friends can take",
      "a page that picks a random workout for today",
      "a guest book people can sign",
      "a page that tracks how much water I drank today",
      "a memory game with pictures of my pets",
      "a page that shows a different quote each morning",
      "a simple budget tracker for the week",
      "a page that helps my kid practise times tables",
      "a snake game",
      "a page that names a random country and shows its flag",
      "a packing checklist for a trip",
      "a page that turns a list of names into random teams",
      "a piano you can play with the keyboard",
    ],
    note: "The more you say, the better it comes out. Mention who it is for and what it should look like.",
    image: {
      src: "/workshops/claude/ask-claude-desktop.png",
      width: 1092,
      height: 292,
      alt: "The Claude Code box with the claude-workspace folder selected and a request typed in",
      caption: "This is what it looks like once your line is in the box.",
    },
  },
  {
    id: "modes",
    part: "getting claude onto your computer",
    title: "Plan first, or just go",
    lines: [
      "Claude has a few modes. Open the little menu by clicking the mode name at the bottom of the box.",
      "Plan is for a big ask, like the whole app you just made. Claude works out what it is going to do and shows you first, before it changes anything.",
      "Auto is for small changes, like making a button bigger or fixing a wrong word. Claude just gets on with it, and only stops to ask about anything risky.",
    ],
    note: "The third choice, Accept edits, lets Claude make every file change without asking. You can leave it on Auto to start.",
    image: {
      src: "/workshops/claude/modes-desktop.png",
      width: 614,
      height: 410,
      alt: "The Claude Code mode menu showing Auto, Accept edits, and Plan",
    },
  },
  {
    id: "context-files",
    part: "getting claude onto your computer",
    title: "Give Claude your own material",
    lines: [
      "If you want Claude to use your own photos, notes, or spreadsheets, drag those files into the claude-workspace folder.",
      "Then mention them in the chat, for example: use the photos in this folder.",
    ],
    art: <ContextFilesArt />,
  },

  {
    id: "vercel-account",
    part: "putting it on the internet",
    title: "Make a free Vercel account",
    lines: [
      "Right now your app exists only on your own computer. Vercel is the service that puts it online so other people can open it.",
      "Go to vercel.com and sign up. It is free to start.",
    ],
    links: [{ href: "https://vercel.com/", label: "Open vercel.com" }],
    image: {
      src: "/workshops/claude/vercel-signup.png",
      width: 1246,
      height: 1068,
      alt: "The Vercel home page with the Sign Up button in the top right circled",
      caption: "Sign Up, top right, circled.",
    },
  },
  {
    id: "vercel-connector",
    part: "putting it on the internet",
    title: "Connect Claude to Vercel",
    lines: [
      "A connector lets Claude talk to Vercel for you. You add it once, from inside the Claude app.",
    ],
    bullets: [
      "Open Connectors in the Claude app.",
      "Make sure you are on Discover, then Directory.",
      "Type vercel in the search box.",
      "Click the plus on Vercel to add it.",
      "Sign in to Vercel when it asks.",
    ],
    note: "A connector is a plug-in that lets Claude use another service on your behalf. You never touch it directly.",
    image: {
      src: "/workshops/claude/vercel-connector.png",
      width: 1062,
      height: 644,
      alt: "The Connectors directory with vercel typed in the search box and the Vercel result showing a plus button",
      caption: "Search vercel, then click the plus to add it.",
    },
  },
  {
    id: "publish",
    part: "putting it on the internet",
    title: "Put it on the internet",
    lines: [
      "Paste this into Claude Code, using the name of the thing you built.",
      "When it finishes, Claude hands you a web address. Open it. That is your app, live, and anyone you send the link to can use it.",
    ],
    copy: { text: "help me publish my app to Vercel" },
    art: <LiveLinkArt />,
  },

  {
    id: "finish",
    part: "the finish line",
    title: "Now show it to someone",
    lines: [
      "You built an app and put it on the internet. That is the same loop professional builders use every day.",
      "One thing left. Add your name and your app's web address to the workshop gallery, so the room can see what everyone built.",
    ],
    // The submit form is the payoff and wants the room, so no picture: the
    // slide runs as a single centred column.
    submit: true,
  },
  {
    id: "ai-build-club",
    part: "the finish line",
    title: "Want to go further?",
    lines: [
      "You just shipped your first app. When you are ready for more, AI Build Club is where builders go next.",
      "They cover the advanced pieces: adding a database, designing a real front end, letting people sign in, using GitHub, and building bigger, more capable apps. It is also where you swap ideas and pick up the newest techniques.",
      "AI Build Club runs tailored workshops and boot camps for advanced builders and anyone who wants to upskill fast.",
    ],
    links: [{ href: "https://aibuildclubdc.com/", label: "Visit AI Build Club" }],
    note: "They meet in person, so you build alongside other people in the room.",
    art: <AiBuildClubArt />,
  },
  // OPTIONAL ADD-ONS. Everything above finishes a working, published app, so
  // these are marked out as a separate part and sit after the finish line. They
  // used to be collapsed cards under the last step, which read as an appendix;
  // as slides they get the same landscape treatment as everything else.
  {
    id: "optional-intro",
    part: "optional extras",
    title: "You are done. The rest is optional",
    lines: [
      "Everything from here is a bonus. Your app already works and it is on the internet.",
      "The next few screens each give Claude one extra power: a safe backup of your work, better web searching, a place to keep information, and a counter for how many people use your app.",
      "Take the ones you want and skip the rest. Each is a one-time setup.",
    ],
    note: "A connector (sometimes called an MCP) is a plug-in that gives Claude a new skill. That is all the word means.",
    wide: true,
  },
  {
    id: "github-account",
    part: "optional extras",
    title: "Make a free GitHub account",
    lines: [
      "GitHub keeps a copy of your project online, along with every version of it. If your laptop dies, your work survives.",
      "Go to github.com and sign up. The free account is plenty.",
    ],
    links: [{ href: "https://github.com/", label: "Open github.com" }],
    image: {
      src: "/workshops/claude/github-signup.png",
      width: 1140,
      height: 796,
      alt: "The GitHub home page with the email box and Sign up for GitHub button circled",
      caption: "Type your email, then Sign up for GitHub.",
    },
  },
  {
    id: "github-setup",
    part: "optional extras",
    title: "Let Claude set up the backup tool",
    lines: [
      "Paste this into Claude Code, then follow the login steps it gives you.",
    ],
    copy: { text: "help me install github cli: https://github.com/cli/cli" },
    art: <ChatArt ask="help me install github cli" reply="Setting that up now..." />,
  },
  {
    id: "github-save",
    part: "optional extras",
    title: "Save your project",
    lines: [
      "Paste this in, and Claude does the rest.",
      "It will ask whether you want it public, meaning anyone can look at it, or private, meaning only you. Either is fine. Pick private if you are unsure.",
    ],
    copy: {
      text: "save my claude-workspace project as a repository in github",
    },
    note: "A repository is just what GitHub calls a saved project.",
    art: <BackupArt />,
  },
  {
    id: "exa",
    part: "optional extras",
    title: "Give Claude better web search",
    lines: [
      "Claude can search the web for you. Exa makes it much better at finding the right page.",
    ],
    bullets: [
      {
        text: "Make an account at exa.ai.",
        link: { href: "https://exa.ai/", label: "Open exa.ai" },
      },
      "In the Claude app, open Connectors, then Discover, then Directory.",
      "Type exa in the search box, then click the plus on Exa to add it.",
      "Back in Claude Code, say: use exa by default.",
    ],
    image: {
      src: "/workshops/claude/exa-connector.png",
      width: 1080,
      height: 676,
      alt: "The Connectors directory with exa typed in the search box and the Exa result added",
      caption: "Search exa, then click the plus to add it.",
    },
  },
  {
    id: "firebase",
    part: "optional extras",
    title: "Let your app remember things",
    lines: [
      "For when your app has to remember things after someone closes it, or people need to log in.",
    ],
    bullets: [
      {
        text: "Make a free account at firebase.google.com.",
        link: {
          href: "https://firebase.google.com/",
          label: "Open firebase.google.com",
        },
      },
      "Paste the line below into Claude Code.",
      "Then tell Claude what you need, like: let people sign in.",
    ],
    copy: {
      text: "help me install firebase mcp: https://firebase.google.com/docs/ai-assistance/mcp-server#claude",
    },
    image: {
      src: "/workshops/claude/firebase.png",
      width: 1134,
      height: 1120,
      alt: "The Firebase home page with a Get Started button",
    },
  },
  {
    id: "posthog",
    part: "optional extras",
    title: "See how many people use your app",
    lines: [
      "A counter for how many people opened your app and what they clicked.",
    ],
    bullets: [
      {
        text: "Make an account at posthog.com. Five are free.",
        link: { href: "https://posthog.com/", label: "Open posthog.com" },
      },
      "Paste the line below into Claude Code.",
      "Then ask Claude to add it to your app.",
    ],
    copy: {
      text: "help me install posthog mcp: https://posthog.com/docs/model-context-protocol",
    },
    image: {
      src: "/workshops/claude/posthog.png",
      width: 1174,
      height: 1044,
      alt: "The PostHog home page with a Get started, free button in the top right",
    },
  },
];

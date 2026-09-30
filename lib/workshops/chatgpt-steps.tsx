import {
  AiBuildClubArt,
  BackupArt,
  ContextFilesArt,
  FolderArt,
  LiveLinkArt,
} from "@/components/workshop/workshop-art";
import type { WorkshopStep } from "./types";

// The ChatGPT twin of the Claude deck (claude-steps.tsx): same arc, same
// beginner rules, one idea per screen. The build happens in Codex, the coding
// mode inside the ChatGPT desktop app (Mac, Windows and Linux): download the
// app, pick Codex, add a folder, describe what you want.
//
// Screenshots are still to come from the owner, so steps that will carry one
// have no image yet and run as a single column. Steps with hand-drawn art keep
// it. When screenshots arrive, add them under public/workshops/chatgpt/ and an
// `image` block to the step, as in the Claude deck.
//
// Connectors: in Codex these are plugins, opened from the Plugins icon in the
// left sidebar (confirmed from the owner's step 11 screenshot). The optional MCP steps hand Codex the docs
// link and let it do the install, which works whatever the settings UI looks
// like on the day.

export const CHATGPT_STEPS: WorkshopStep[] = [
  {
    id: "welcome",
    part: "before you start",
    title: "Build a website",
    lines: [
      "Build a website, one step at a time. You say what you want, and ChatGPT writes the code for you.",
      "By the end you will have something that works, a web address you can send to anyone, and a safe backup of it.",
      "Set aside about 45 minutes. You need a laptop for this one, not a phone.",
    ],
    image: {
      src: "/workshops/chatgpt/title-cover.png",
      width: 1254,
      height: 1254,
      alt: "Build a website in 1 hour, beginner-friendly, with ChatGPT and Vercel",
    },
  },

  {
    id: "get-chatgpt",
    part: "getting chatgpt onto your computer",
    title: "Get ChatGPT",
    lines: [
      "ChatGPT is the assistant that does the building. Go to chatgpt.com and make an account.",
      "Choose the Plus plan at $20 a month. The free one runs out partway through a project.",
    ],
    links: [{ href: "https://chatgpt.com/", label: "Open chatgpt.com" }],
  },
  {
    id: "download-chatgpt",
    part: "getting chatgpt onto your computer",
    title: "Download the ChatGPT desktop app",
    lines: [
      "ChatGPT does all its building right inside the ChatGPT desktop app on your computer. There is no separate program to install.",
      "Go to the page below and click the download button for your computer. Open the file when it finishes and follow the installer.",
      "Then open the app and sign in with the account you just made.",
    ],
    links: [{ href: "https://chatgpt.com/download", label: "Open chatgpt.com/download" }],
  },
  {
    id: "open-codex",
    part: "getting chatgpt onto your computer",
    title: "Open Codex",
    lines: [
      "At the top of the ChatGPT app, click the word ChatGPT to open the menu.",
      "Choose Codex. That is the part that builds your app. You are already signed in, so there is nothing else to set up.",
    ],
    image: {
      src: "/workshops/chatgpt/open-codex.png",
      width: 676,
      height: 442,
      alt: "The ChatGPT app menu opened from the ChatGPT title, with Codex circled below ChatGPT",
      caption: "Click ChatGPT at the top (1), then choose Codex (2).",
    },
    note: "Codex is the builder that comes with ChatGPT. It is where you type what you want and watch ChatGPT make it.",
  },
  {
    id: "make-folder",
    part: "getting chatgpt onto your computer",
    title: "Make a folder for your work",
    lines: [
      "Go to your desktop and make a new folder. Name it chatgpt-workspace.",
      "This is where your app will live. Everything ChatGPT builds goes in here.",
    ],
    note: "On a Mac, right-click the desktop and choose New Folder. On Windows, right-click and choose New, then Folder.",
    art: <FolderArt name="chatgpt-workspace" />,
  },
  {
    id: "pick-folder",
    part: "getting chatgpt onto your computer",
    title: "Point Codex at your folder",
    lines: [
      "Tell Codex which folder to work in. Follow the numbers in the pictures.",
    ],
    bullets: [
      "Click Choose project, next to This computer.",
      "Click New project.",
      "Under Source folders, click Add and pick the chatgpt-workspace folder you just made.",
      "Give the project a name, like chatgpt-workspace.",
      "Click Create project. Now everything Codex builds goes into that folder.",
    ],
    image: [
      {
        src: "/workshops/chatgpt/choose-project.png",
        width: 726,
        height: 214,
        alt: "The bar under the Codex chat box with Choose project circled and New project circled in the menu above it",
        caption: "Click Choose project (1), then New project (2).",
      },
      {
        src: "/workshops/chatgpt/create-project.png",
        width: 1182,
        height: 702,
        alt: "The Create project window with the Add folder button, the Project name box, and the Create project button circled",
        caption: "Add your folder (3), name the project (4), then Create project (5).",
      },
    ],
    note: "Leave This computer selected, so Codex works on your own laptop.",
  },
  {
    id: "build-something",
    part: "getting chatgpt onto your computer",
    title: "Ask ChatGPT to build something",
    lines: [
      "Pick something below, or type your own. Then copy the line and paste it into Codex.",
      "Codex writes the files and shows you what it is doing as it goes. It can take a few minutes, so let it finish.",
    ],
    // Same one-sitting builds as the Claude deck: a first project needs to
    // finish and work.
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
      src: "/workshops/chatgpt/ask-codex.png",
      width: 868,
      height: 368,
      alt: "The Codex chat box with a project folder and This computer selected, and a request to build a rock paper scissors game typed in",
      caption: "This is what it looks like once your line is in the box. Press the arrow to send it.",
    },
  },
  {
    id: "modes",
    part: "getting chatgpt onto your computer",
    title: "Plan first, or just go",
    lines: [
      "Codex can plan before it builds. Click the + at the bottom left of the box where you type, then choose Plan mode. Or press Shift and Tab together.",
      "Plan is for a big ask, like the whole app you just made. Codex looks around, works out what it is going to do, and shows you first, before it changes anything. Then it asks whether to go ahead.",
      "For small changes, like making a button bigger or fixing a wrong word, skip Plan. Codex just gets on with it.",
    ],
    note: "Codex asks before doing anything risky. You can leave those settings as they are to start.",
    image: {
      src: "/workshops/chatgpt/plan-mode.png",
      width: 844,
      height: 572,
      alt: "The menu opened from the + button in the Codex chat box, with the + button and Plan mode circled",
      caption: "Click the + (1), then Plan mode (2).",
    },
  },
  {
    id: "context-files",
    part: "getting chatgpt onto your computer",
    title: "Give ChatGPT your own material",
    lines: [
      "If you want ChatGPT to use your own photos, notes, or spreadsheets, drag those files into the chatgpt-workspace folder.",
      "Then mention them in the chat, for example: use the photos in this folder.",
    ],
    art: <ContextFilesArt folder="chatgpt-workspace" />,
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
    // Same Vercel page for either assistant, so this reuses the Claude deck's file.
    image: {
      src: "/workshops/claude/vercel-signup.png",
      width: 1246,
      height: 1068,
      alt: "The Vercel home page with the Sign Up button in the top right circled",
      caption: "Sign Up, top right, circled.",
    },
  },
  {
    id: "vercel-plugin",
    part: "putting it on the internet",
    title: "Connect ChatGPT to Vercel",
    lines: [
      "A plugin lets Codex talk to Vercel for you. You add it once, from inside the ChatGPT app.",
    ],
    bullets: [
      "In the left sidebar of Codex, click the Plugins icon.",
      "Type vercel in the search box.",
      "On the Vercel result, click the button on the right to add it.",
      "Sign in to Vercel when it asks.",
    ],
    note: "A plugin lets Codex use another service on your behalf. You never touch it directly.",
    image: {
      src: "/workshops/chatgpt/vercel-plugin.png",
      width: 1222,
      height: 864,
      alt: "The Codex Plugins page with the Plugins sidebar icon, the search box with vercel typed in, and the button on the Vercel result circled",
      caption: "Plugins icon (1), search vercel (2), then add Vercel (3).",
    },
  },
  {
    id: "publish",
    part: "putting it on the internet",
    title: "Put it on the internet",
    lines: [
      "Paste this into Codex.",
      "When it finishes, Codex hands you a web address. Open it. That is your app, live, and anyone you send the link to can use it.",
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
  // OPTIONAL ADD-ONS, after the finish line, as in the Claude deck.
  {
    id: "optional-intro",
    part: "optional extras",
    title: "You are done. The rest is optional",
    lines: [
      "Everything from here is a bonus. Your app already works and it is on the internet.",
      "The next few screens each give ChatGPT one extra power: a safe backup of your work, better web searching, a place to keep information, and a counter for how many people use your app.",
      "Take the ones you want and skip the rest. Each is a one-time setup.",
    ],
    note: "An MCP is a plug-in that gives Codex a new skill. That is all the word means.",
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
    // Same GitHub page for either assistant, so this reuses the Claude deck's file.
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
    title: "Connect Codex to GitHub",
    lines: [
      "Add the GitHub plugin, the same way you added Vercel. Then Codex can save your project to GitHub for you.",
    ],
    bullets: [
      "In the left sidebar of Codex, click the Plugins icon.",
      "Type github in the search box.",
      "On the GitHub result, click the button on the right to add it.",
      "Sign in to GitHub when it asks.",
    ],
    image: {
      src: "/workshops/chatgpt/github-plugin.png",
      width: 976,
      height: 626,
      alt: "The Codex Plugins page with github typed in the search box and the GitHub plugin in the results",
      caption: "Search github, then add the GitHub plugin.",
    },
  },
  {
    id: "github-save",
    part: "optional extras",
    title: "Save your project",
    lines: [
      "Paste this in, and Codex does the rest.",
      "It will ask whether you want it public, meaning anyone can look at it, or private, meaning only you. Either is fine. Pick private if you are unsure.",
    ],
    copy: {
      text: "save my chatgpt-workspace project as a repository in github",
    },
    note: "A repository is just what GitHub calls a saved project.",
    art: <BackupArt />,
  },
  {
    id: "exa",
    part: "optional extras",
    title: "Give ChatGPT better web search",
    lines: [
      "Codex can search the web for you. Exa makes it much better at finding the right page.",
    ],
    bullets: [
      {
        text: "Make an account at exa.ai.",
        link: { href: "https://exa.ai/", label: "Open exa.ai" },
      },
      "Paste the line below into Codex.",
      "Once it is set up, say: use exa by default.",
    ],
    copy: {
      text: "help me install exa mcp: https://docs.exa.ai/reference/exa-mcp",
    },
    // Reused from the Claude deck. It shows Claude's Connectors screen, so no
    // caption: this deck installs Exa by prompt, not by clicking a plus.
    image: {
      src: "/workshops/claude/exa-connector.png",
      width: 1080,
      height: 676,
      alt: "The Exa search tool listed in a connectors directory",
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
      "Paste the line below into Codex.",
      "Then tell Codex what you need, like: let people sign in.",
    ],
    copy: {
      text: "help me install firebase mcp: https://firebase.google.com/docs/ai-assistance/mcp-server",
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
      "Paste the line below into Codex.",
      "Then ask Codex to add it to your app.",
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

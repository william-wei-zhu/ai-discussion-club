// Every workshop the club runs, one card each on /workshops. Add a workshop by
// adding an entry here, a steps file in lib/workshops/, and a page at
// app/workshops/<slug>/page.tsx that renders <WorkshopWizard>.
export type Workshop = {
  slug: string;
  title: string;
  blurb: string;
  cover: { src: string; alt: string };
  duration: string;
  tools: string;
  // Slugs this workshop used to live at. Old URLs redirect here permanently
  // (next.config.ts) and gallery entries stored under them keep this title.
  previousSlugs?: string[];
};

export const WORKSHOPS: Workshop[] = [
  {
    slug: 'build-a-website-with-claude',
    previousSlugs: ['build-your-first-website-with-claude'],
    title: 'Build a website with Claude',
    blurb: 'Build your very first web app with Claude, put it on the internet, and keep it safe. Beginners welcome, one step at a time.',
    cover: { src: '/workshops/claude/title-cover.png', alt: 'Build a website in 1 hour, beginner-friendly, with Claude and Vercel' },
    duration: 'About 45 minutes',
    tools: 'Claude and Vercel',
  },
  {
    slug: 'build-a-website-with-chatgpt',
    previousSlugs: ['build-your-first-website-with-chatgpt'],
    title: 'Build a website with ChatGPT',
    blurb: 'Build your very first web app with ChatGPT, put it on the internet, and keep it safe. Beginners welcome, one step at a time.',
    cover: { src: '/workshops/chatgpt/title-cover.png', alt: 'Build a website in 1 hour, beginner-friendly, with ChatGPT and Vercel' },
    duration: 'About 45 minutes',
    tools: 'ChatGPT and Vercel',
  },
];

export const workshopPath = (slug: string) => `/workshops/${slug}`;

// Current or previous slug to the workshop, so records written before a rename
// still resolve.
export function findWorkshop(slug: string): Workshop | undefined {
  return WORKSHOPS.find((w) => w.slug === slug || w.previousSlugs?.includes(slug));
}

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
};

export const WORKSHOPS: Workshop[] = [
  {
    slug: 'build-your-first-website-with-claude',
    title: 'Build your first website with Claude',
    blurb: 'Build your very first web app with Claude, put it on the internet, and keep it safe. Beginners welcome, one step at a time.',
    cover: { src: '/workshops/claude/title-cover.png', alt: 'Build your first website in 2 hours, beginner-friendly, with Claude and Vercel' },
    duration: 'About 45 minutes',
    tools: 'Claude and Vercel',
  },
];

export const workshopPath = (slug: string) => `/workshops/${slug}`;

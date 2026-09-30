import type { Metadata } from 'next';
import { WorkshopWizard } from '@/components/workshop/workshop-wizard';
import { CLAUDE_STEPS } from '@/lib/workshops/claude-steps';

const SHARE_IMAGE = {
  url: '/workshops/claude/title-cover.png',
  width: 1254,
  height: 1254,
  alt: 'Build a website in 1 hour, beginner-friendly, with Claude and Vercel',
};
const description = 'Build a website with Claude, put it on the internet, and keep it safe. Beginners welcome, one step at a time.';

export const metadata: Metadata = {
  title: 'Build a website with Claude',
  description: 'A free, step-by-step workshop that walks you through building a website with Claude, putting it on the internet, and keeping it safe. Beginners welcome.',
  openGraph: { title: 'Build a website with Claude', description, images: [SHARE_IMAGE] },
  twitter: { card: 'summary_large_image', title: 'Build a website with Claude', description, images: [SHARE_IMAGE.url] },
};

// No page hero: it would cost roughly a third of the vertical space on every
// slide. The title lives on step 1, which is the title slide.
export default function ClaudeWorkshopPage() {
  return <WorkshopWizard workshop="build-a-website-with-claude" steps={CLAUDE_STEPS} storageKey="adc-workshop-claude-step" />;
}

import type { Metadata } from 'next';
import { WorkshopWizard } from '@/components/workshop/workshop-wizard';
import { EXA_STEPS } from '@/lib/workshops/exa-steps';

const SHARE_IMAGE = {
  url: '/workshops/exa/title-cover.png',
  width: 1254,
  height: 1254,
  alt: 'AI-Powered Growth: Outreach, Pipeline, and Getting Found by AI. DC Startup and Tech Week, Tuesday, October 20, 2026, 9:00 to 9:45 AM ET, MLK Conference Center',
};
const description = 'Use Exa to research the right people, write messages they answer, and build a real list. Works with Claude or ChatGPT.';

export const metadata: Metadata = {
  title: 'Reach the right people with Exa',
  description: 'A free, step-by-step workshop: connect Claude or ChatGPT to Exa, research one person and write them a message they want to answer, then build a list of the right people and work through it.',
  openGraph: { title: 'Reach the right people with Exa', description, images: [SHARE_IMAGE] },
  twitter: { card: 'summary_large_image', title: 'Reach the right people with Exa', description, images: [SHARE_IMAGE.url] },
};

// Same shape as the website decks: no page hero, step 1 is the title slide.
// One deck for both assistants, so the copy boxes name both.
export default function ExaWorkshopPage() {
  return <WorkshopWizard workshop="reach-the-right-people-with-exa" steps={EXA_STEPS} storageKey="adc-workshop-exa-step" assistant="Claude or ChatGPT" bigMedia />;
}

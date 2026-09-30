import type { Metadata } from 'next';
import { WorkshopWizard } from '@/components/workshop/workshop-wizard';
import { CHATGPT_STEPS } from '@/lib/workshops/chatgpt-steps';

const SHARE_IMAGE = {
  url: '/workshops/chatgpt/title-cover.png',
  width: 1254,
  height: 1254,
  alt: 'Build a website in 1 hour, beginner-friendly, with ChatGPT and Vercel',
};
const description = 'Build a website with ChatGPT, put it on the internet, and keep it safe. Beginners welcome, one step at a time.';

export const metadata: Metadata = {
  title: 'Build a website with ChatGPT',
  description: 'A free, step-by-step workshop that walks you through building a website with ChatGPT, putting it on the internet, and keeping it safe. Beginners welcome.',
  openGraph: { title: 'Build a website with ChatGPT', description, images: [SHARE_IMAGE] },
  twitter: { card: 'summary_large_image', title: 'Build a website with ChatGPT', description, images: [SHARE_IMAGE.url] },
};

// Same shape as the Claude deck: no page hero, step 1 is the title slide.
// Prompts are pasted into Codex, so the copy boxes say "type this to Codex".
export default function ChatGPTWorkshopPage() {
  return <WorkshopWizard workshop="build-a-website-with-chatgpt" steps={CHATGPT_STEPS} storageKey="adc-workshop-chatgpt-step" assistant="Codex" />;
}

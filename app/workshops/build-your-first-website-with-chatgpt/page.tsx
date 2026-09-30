import type { Metadata } from 'next';
import { WorkshopWizard } from '@/components/workshop/workshop-wizard';
import { CHATGPT_STEPS } from '@/lib/workshops/chatgpt-steps';

const SHARE_IMAGE = {
  url: '/workshops/chatgpt/title-cover.png',
  width: 1254,
  height: 1254,
  alt: 'Build your first website in 1 hour, beginner-friendly, with ChatGPT and Vercel',
};
const description = 'Build your very first web app with ChatGPT, put it on the internet, and keep it safe. Beginners welcome, one step at a time.';

export const metadata: Metadata = {
  title: 'Build your first website with ChatGPT',
  description: 'A free, step-by-step workshop that walks you through building your very first web app with ChatGPT, putting it on the internet, and keeping it safe. Beginners welcome.',
  openGraph: { title: 'Build your first website with ChatGPT', description, images: [SHARE_IMAGE] },
  twitter: { card: 'summary_large_image', title: 'Build your first website with ChatGPT', description, images: [SHARE_IMAGE.url] },
};

// Same shape as the Claude deck: no page hero, step 1 is the title slide.
// Prompts are pasted into Codex, so the copy boxes say "type this to Codex".
export default function ChatGPTWorkshopPage() {
  return <WorkshopWizard workshop="build-your-first-website-with-chatgpt" steps={CHATGPT_STEPS} storageKey="adc-workshop-chatgpt-step" assistant="Codex" />;
}

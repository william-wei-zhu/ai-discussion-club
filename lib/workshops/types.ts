import type { ReactNode } from "react";

// The shape of one workshop slide. Every workshop deck is an array of these,
// rendered by components/workshop/workshop-wizard.tsx.

export type WorkshopBullet =
  | string
  | { text: string; link: { href: string; label: string } };

export type WorkshopStep = {
  id: string;
  // Section label shown above the title, groups steps into four parts.
  part: string;
  title: string;
  lines: string[];
  // A copy-to-clipboard box, so nobody has to retype a prompt correctly.
  copy?: { text: string; label?: string };
  // Swaps the fixed copy box for one where the reader supplies the idea (typed
  // or rolled from this list) and the prompt assembles itself.
  ideas?: string[];
  // Numbered sub-steps, for the optional add-ons. A bullet can carry its own
  // inline button when the action belongs right next to that line rather than
  // in the row under the picture.
  bullets?: WorkshopBullet[];
  // Ride in the left column with the picture, since "open the site" pairs with
  // the picture of the site.
  links?: { href: string; label: string }[];
  image?: {
    src: string;
    width: number;
    height: number;
    alt: string;
    caption?: string;
  };
  art?: ReactNode;
  // A smaller aside. Rides in the left column on a two-column slide, since it
  // is secondary and moving it is what keeps the instruction column short.
  note?: string;
  // Run as one centred column instead of the two-column slide, for a step whose
  // main content wants the full width.
  wide?: boolean;
};

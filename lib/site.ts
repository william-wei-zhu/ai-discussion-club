export const siteName = 'AI Discussion Club';
export const tagline = 'Make DC the City for Innovators';
export const lumaUrl = 'https://luma.com/ai-discussion-club';
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aidiscussionclub.com';
export const isCanonical = !!process.env.NEXT_PUBLIC_SITE_URL && new URL(siteUrl).hostname === 'aidiscussionclub.com';
export const communityPhotos = [
  '/photos/community-02.png', '/photos/community-08.jpg', '/photos/community-05.jpg',
  '/photos/community-01.png', '/photos/community-03.jpeg', '/photos/community-04.jpeg',
  '/photos/community-06.png', '/photos/community-07.png', '/photos/community-09.png',
  '/photos/community-10.jpg', '/photos/community-11.png', '/photos/community-12.png',
  '/photos/community-13.png', '/photos/community-14.png',
];

export const site = { name: siteName, url: siteUrl, tagline };

export const siteName = 'AI Discussion Club';
export const tagline = 'Make DC the City for Innovators';
export const lumaUrl = 'https://luma.com/ai-discussion-club';
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aidiscussionclub.com';
export const isCanonical = !!process.env.NEXT_PUBLIC_SITE_URL && new URL(siteUrl).hostname === 'aidiscussionclub.com';
export const communityPhotos = [
  '/photos/community-02.jpg', '/photos/community-08.jpg', '/photos/community-05.jpg',
  '/photos/community-01.jpg', '/photos/community-03.jpg', '/photos/community-04.jpg',
  '/photos/community-06.jpg', '/photos/community-07.jpg', '/photos/community-09.jpg',
  '/photos/community-10.jpg', '/photos/community-11.jpg', '/photos/community-12.jpg',
  '/photos/community-13.jpg', '/photos/community-14.jpg',
];

export const site = { name: siteName, url: siteUrl, tagline };

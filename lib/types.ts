// Shared domain types for SuperIntro.

// Posts (needs / offers) are capped at this many words. Kept short so
// posts stay scannable needs/offers, not essays.
export const MAX_POST_WORDS = 80;

// The profile one-liner (headline) shown under a name on feed cards + profiles.
// Capped so it stays a scannable single thought, not a paragraph, while leaving
// generous room (e.g. "CEO at Learning Journey AI, focused on workforce AI
// literacy" is ~60). Enforced client-side (input maxLength) + server-side.
export const MAX_HEADLINE_CHARS = 100;

// The one "Nearby only" radius offered today (Settings toggle). Feed filtering
// reads the per-person feedRadiusMiles value, so adding radii later is cheap.
export const NEARBY_RADIUS_MILES = 20;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type Source = "club_seed" | "signup";

export interface ProfileLink {
  label: string;
  url: string;
}

// Typed social links (LinkedIn lives in Person.linkedinUrl; these are the rest).
export interface Social {
  x?: string;
  github?: string;
  website?: string;
  calendar?: string; // booking link (Calendly / cal.com / Google Calendar) — shown on profile + intro email
  other?: string;
}

export interface Person {
  uid: string;
  name: string;
  headline: string;
  photo?: string;
  linkedinUrl: string;
  location?: string; // optional, user-editable; shown on the profile only when set
  // PRIVATE 5-digit US zipcode, used only for server-side "nearby" distance
  // math. NEVER expose it in toPublicPersonView or any client-facing payload
  // except /api/me (the owner). Backfilled from `location` via Gemini for
  // pre-existing members (scripts/backfill-zipcodes.ts).
  zip?: string;
  // "Nearby only" feed preference: only show posts from authors within this
  // many miles (currently the single option NEARBY_RADIUS_MILES). Absent =
  // anywhere. Numeric so future radii stay cheap.
  feedRadiusMiles?: number;
  email?: string; // login/identity key (verified token email; never user-edited)
  contactEmail?: string; // where intros/recommendations are sent; defaults to email, user-editable
  introConsent: boolean;
  // Per-type email notification prefs. Absent = on (default-on). introConsent
  // gates the intro email; these gate the other two notification emails.
  notifyRequests?: boolean; // someone responds to your post
  notifyWeekly?: boolean; // weekly digest of new suggested connections
  notifyMessages?: boolean; // new DIRECT chat message (when you're away)
  notifyGroupMessages?: boolean; // new GROUP chat message (when you're away)
  mutedGroupIds?: string[]; // group ids this person has muted (no group-chat email)
  // Uids this person has blocked. A block is directional in storage but enforced
  // symmetrically: if EITHER party blocked the other, they can't connect, DM, or
  // see each other in feed/discovery/matchmaker (see lib/block.ts).
  blockedUids?: string[];
  // When we emailed this member the ~7-day product-feedback invite (idempotency
  // marker for the feedback-invite cron; set once so they're never re-invited).
  feedbackInviteSentAt?: number;
  // When the member last opened the in-app notifications rollup (avatar dropdown).
  // Notification items newer than this count as "unread" for the avatar badge;
  // opening the dropdown advances it. The one bit of persisted state the rollup
  // needs (it is otherwise fully DERIVED from matches + chats, no inbox store).
  notificationsReadAt?: number;
  // The member whose referral link (?ref=<uid>) brought this person in. Set once
  // at signup (new-person create only), never overwritten. Powers growth attribution.
  referredBy?: string;
  // When true the profile is "unlisted": the member can't post publicly (posts are
  // coerced to connections), is skipped by the stranger matchmaker, and their
  // profile page is noindex with a generic social card. Absent/false = public.
  privateProfile?: boolean;
  // Every Firebase Auth uid we've seen for this person (Google/email/LinkedIn can
  // each yield a different one; the person-doc uid is a LinkedIn handle, decoupled
  // from these). Used to bridge chat Firestore security rules, which see
  // request.auth.uid. Maintained server-side via people.ensureAuthUid.
  authUids?: string[];
  claimed: boolean;
  source: Source;
  about?: string; // warm, first-person current story
  social?: Social; // typed social links (x / github / website / other)
  links?: ProfileLink[]; // DEPRECATED legacy curated links (read-only; migrated to social on save)
  createdAt: number;
}

export interface Intent {
  id: string;
  text: string;
  embedding: number[];
  active: boolean;
  expiresAt: number;
}

// A LEAD is an anonymous, pre-signup intake from the logged-out home: a visitor
// tells us what they need + can offer and leaves a way to reach them, WITHOUT
// creating an account. Server-mediated only (admin SDK; never client-read), it is
// the founder-concierge queue: an anonymous lead is NOT in the auto-matcher pool
// (loadPool only reads claimed members' public posts), so intros are emailed by
// hand until the lead signs up and their intent becomes seed posts. The embeddings
// let us rank fits + power the on-submit "N fits" teaser.
export interface Lead {
  id: string;
  email: string; // where we contact them; unverified (NOT the login/identity key)
  name?: string;
  linkedinUrl?: string;
  needText?: string; // "goals you're working toward, and who could help"
  offerText?: string; // "what you're great at, and who you could help"
  needEmbedding?: number[]; // 768-dim embedding of needText
  offerEmbedding?: number[]; // 768-dim embedding of offerText
  enrichedHeadline?: string; // best-effort from linkedinUrl (Exa + Gemini)
  enrichedAbout?: string;
  teaserNeedFits?: number; // people in the live pool who could help them (offers vs need)
  teaserOfferFits?: number; // people they could help (needs vs offer)
  referredBy?: string; // the member whose ?ref=<uid> link brought them (growth attribution)
  converted?: boolean; // set true once they sign up (matched by email)
  convertedUid?: string;
  createdAt: number;
}

// In-app chat. A thread is either a 1:1 "direct" chat (id = pairKey, only ever
// between two MUTUAL connections) or a "group" chat (id = groupId, for a group's
// members). Writes are server-mediated (admin SDK); clients READ in realtime via
// onSnapshot, gated by Firestore rules that check request.auth.uid ∈ memberAuthUids.
export interface Chat {
  id: string;
  kind: "direct" | "group";
  memberUids: string[]; // person uids
  memberAuthUids: string[]; // Firebase auth uids of members (for the read rule)
  memberInfo?: Record<string, { name: string; photo?: string }>; // denormalized for the realtime list
  groupId?: string; // set iff kind === "group"
  name?: string; // group name, denormalized for the chat list (group chats only)
  photo?: string; // group avatar, denormalized for group chats (group chats only)
  lastMessageAt?: number;
  lastMessageText?: string;
  lastSenderUid?: string;
  lastReadAt?: Record<string, number>; // person uid -> ms they last read this thread
  lastNotifiedAt?: Record<string, number>; // person uid -> ms we last emailed them about this thread
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  createdAt: number;
}

// An Intent is an Ask or an Offer (same shape, different subcollection).
export type Ask = Intent;
export type Offer = Intent;

// A post is the unit of the home feed: a need or an offer.
// Complementarity (needs vs offers) drives matching.
export type PostType = "need" | "offer";

export interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorHeadline: string;
  authorPhoto?: string; // denormalized avatar (/api/img/... path) for the feed
  authorClaimed: boolean; // unclaimed authors stay hidden from the public feed
  authorZip?: string; // PRIVATE denorm for the nearby filter; stripped from PublicPost
  type: PostType;
  // Audience: "public" (default, in the feed/discovery/profile/permalink),
  // "connections" (visible only to the author + their confirmed connections), or
  // "group" (visible only to the author + members of `groupId`). Non-public posts
  // are hidden from guests/non-members and excluded from the stranger matchmaker.
  visibility?: "public" | "connections" | "group";
  groupId?: string; // set iff visibility === "group": the audience group
  text: string;
  image?: string; // optional feed image (an /api/img/... path)
  linkPreview?: { url: string; title?: string; description?: string; image?: string }; // OG preview of the first URL in text
  // Engagement funnel (denormalized counters; see lib/posts increment helpers).
  requestedCount?: number; // people who reached out (a linkup request on this post)
  connectedCount?: number; // requests that became a warm intro (mutual opt-in)
  metCount?: number; // intros that led to a confirmed meeting
  embedding: number[];
  active: boolean;
  expiresAt: number;
  createdAt: number;
  updatedAt?: number;
}

// Post without the embedding or the author's private zip, for sending to the client.
export type PublicPost = Omit<Post, "embedding" | "authorZip">;

// A private group: a user-created circle joined via an unguessable invite link.
// `members` includes the owner. A post with visibility "group" + this group's id
// is visible only to these members. Modeled on the `connections` membership shape
// (members[] + array-contains queries).
export interface Group {
  id: string;
  name: string;
  description?: string; // the editable "About" intro
  photo?: string; // /api/img/avatars/... group avatar (owner-uploaded)
  link?: string; // a single normalized web link for the group
  ownerUid: string;
  members: string[]; // person uids (includes ownerUid)
  inviteToken: string; // unguessable; rotate to revoke the share link
  createdAt: number;
  updatedAt?: number;
}

export type MatchState =
  | "suggested" // weekly-cron recommendation; NOT a request (nobody opted in)
  | "proposed"
  | "both_opted_in"
  | "introduced"
  | "met"
  | "rated"
  | "declined";

export interface Match {
  id: string;
  aUid: string;
  bUid: string;
  score: number;
  reasonToTalk: string;
  aTalkingPoints: string[];
  bTalkingPoints: string[];
  aOptIn: boolean | null;
  bOptIn: boolean | null;
  state: MatchState;
  origin?: string; // "post" (post response), "connect" (QR/profile), "broker" (third-party intro), "weekly" (cron suggestion)
  postId?: string; // the originating post (set by ensureMatchForPost)
  brokerUid?: string; // the member who brokered this intro (set when origin === "broker")
  requestMessage?: string; // the requester's optional personal note (post/connect request; from bUid)
  connectedCountedAt?: number; // idempotency guard for the post connectedCount
  metCountedAt?: number; // idempotency guard for the post metCount
  metAt?: number; // when a meeting was confirmed via feedback
  introEmailSentAt?: number;
  requestEmailSentAt?: number; // guard: author nudged once per pending request
  createdAt: number;
}

// What the LLM extracts from a raw profile.
export interface ExtractedProfile {
  headline: string;
  about: string;
  links: ProfileLink[];
  asks: string[];
  offers: string[];
}

// --- AI Discussion Club (private, admin-only: the Luma events CRM + the T-24h
// "5 people to meet" blast). Every collection below is SERVER-ONLY: reached only
// through the admin SDK, never client-read, so firestore.rules stays deny-all. ---

// Where a contact's LinkedIn URL came from, and how much we trust it. Only
// "given" and "high" ever render a link in an email: putting the wrong person's
// profile in front of 98 strangers is the one mistake with no recovery.
export type LinkedInSource = "registration" | "club_json" | "exa_search" | "admin";
export type LinkedInConfidence = "given" | "high" | "low";

// How much we know about a person, which decides whether their why-line can be
// reasoned (Gemini) or must be extractive (their own words) or neutral (nothing).
export type SignalTier = "answers" | "linkedin" | "none";

// clubContacts/{user_api_id} — one per human on the Luma calendar. Doc id is
// Luma's user_api_id: stable for the same person across every event, unlike the
// per-event gst- id or an email (which is PII in a doc path and changes jobs).
export interface ClubContact {
  id: string; // === Luma user_api_id
  name: string;
  firstName?: string;
  lastName?: string;
  email: string; // lowercased
  avatarUrl?: string;
  lumaPersonApiId?: string; // the calendar-membership api_id (not the person)
  tags: string[]; // ["Core Audience"] | ["Maybe"] | ["Waitlist"] | []
  eventApprovedCount: number;
  eventCheckedInCount: number; // Luma's own count, surfaced as-is (no manual UI)
  revenueUsdCents?: number;
  linkedinUrl?: string;
  linkedinSource?: LinkedInSource;
  linkedinConfidence?: LinkedInConfidence;
  // A low-confidence Exa hit, kept for one admin glance (Confirm/Reject on the
  // guest row). NEVER emailed and never fed to the extractor.
  linkedinCandidate?: { url: string; name?: string; headline?: string; foundAt: number };
  // The profile photo imported from LinkedIn, as a stable /api/img/avatars/... path.
  // Preferred over the Luma avatar whenever the LinkedIn URL is trusted: a raw
  // media.licdn.com URL is signed and expires, so it is copied into our own bucket
  // rather than hotlinked into an email that people open days later.
  linkedinPhoto?: string;
  headline?: string;
  signalTier?: SignalTier;
  emailOptOut?: boolean;
  optOutAt?: number;
  // Audit trail for putting someone BACK on the list. Re-adding a person who opted
  // out is only legitimate when they asked, so it records who did it and when
  // rather than silently flipping the flag.
  resubscribedAt?: number;
  resubscribedBy?: string;
  emailBouncedAt?: number; // a Resend send error; skipped next event
  bounceClearedAt?: number;
  // Anti-repeat, denormalized: otherId -> last time we recommended them to each
  // other. Lives here (not a pair collection) because prepare already reads every
  // recipient's contact doc, so the history costs zero extra reads.
  recommendedTo?: Record<string, number>;
  recommendedPairs?: Record<string, number>; // otherId -> times surfaced
  recommendedCount?: number; // times recommended TO someone (exposure fairness)
  firstSeenAt: number;
  lastSyncedAt: number;
}

// clubContacts/{id}/signal/current — the vectors, in a SUBCOLLECTION. A 768-dim
// embedding is ~6KB, so a contact with 3 asks + 3 offers is ~37KB: fine per doc,
// but 98 of them in one doc would be 3.6MB against Firestore's 1MB limit, and on
// the roster doc a 1,103-row CRM read would move ~40MB.
export interface ClubSignal {
  tier: SignalTier;
  sourceHash: string; // sha256 of the exact text fed to Gemini; the cache key
  asks: Intent[];
  offers: Intent[];
  topAskText?: string;
  topOfferText?: string;
  builtAt: number;
}

// clubContacts/{id}/signal/exa — raw enrichment cache. The repo has no caching
// layer today; this is the difference between a 6-minute prepare and a 45s one.
export interface ClubExaCache {
  url?: string;
  name?: string;
  headline?: string;
  text?: string;
  // The profile photo URL Exa returned. Cached so a photo backfill never needs a
  // second paid lookup.
  image?: string;
  fetchedAt: number;
  confidence: LinkedInConfidence;
  searchQuery?: string;
  rejected?: "name-mismatch" | "no-content" | "ambiguous" | "not-found";
}

export interface ClubEventCounts {
  total: number;
  approved: number;
  invited: number;
  declined: number;
  checkedIn: number;
}

// clubEvents/{event_api_id} — the Luma event mirror plus this event's job state.
export interface ClubEvent {
  id: string; // === Luma event api_id
  name: string;
  startAt: number; // ms epoch, from Date.parse(start_at)
  startAtIso?: string;
  endAtIso?: string;
  timezone?: string;
  url?: string;
  coverUrl?: string;
  address?: string;
  requireApproval?: boolean;
  visibility?: string;
  registrationQuestions?: { id: string; label: string; questionType: string }[];
  // The event's ORGANIZERS. A first-class Luma concept, fetched from /event/get:
  // they are not attendees, and the guest list files them under "invited", so an
  // approved-only filter would exclude the people actually running the room.
  hosts?: { id: string; name: string; email: string; avatarUrl?: string }[];
  counts: ClubEventCounts;
  guestsSyncedAt?: number;
  // Job state. autoSend arms the T-24h blast; cancelled blocks only the SEND.
  autoSend?: boolean;
  // Audit trail for arming: who turned automatic sending on, and when. Informational
  // only; `autoSend` alone decides whether the cron sends. Absent on events armed
  // before these fields existed.
  autoSendArmedAt?: number;
  autoSendArmedBy?: string;
  cancelled?: boolean;
  cancelledAt?: number;
  cancelledBy?: string;
  prepare?: {
    startedAt: number;
    completedAt?: number;
    recipients?: number;
    withLinkedIn?: number;
    zeroSignal?: number;
    geminiFallbacks?: number;
    shortLists?: number;
    exaCalls?: number;
    error?: string;
  };
  previewEmailedAt?: number;
  send?: {
    startedAt: number;
    completedAt?: number;
    sent: number;
    skipped: number;
    failed: number;
    lastTickAt?: number;
    error?: string;
  };
  // The "Connect with fellow participants" email sent when the event ends.
  connect?: {
    startedAt: number;
    completedAt?: number;
    sent: number;
    skipped: number;
    failed: number;
    lastTickAt?: number;
    error?: string;
  };
  syncedAt: number;
}

// clubEvents/{eid}/guests/{user_api_id} — one per registration on that event.
export interface ClubGuest {
  id: string; // === user_api_id
  guestApiId?: string; // gst-... , per event
  name: string;
  email: string;
  approvalStatus: string;
  registeredAt?: number;
  createdAt?: number;
  checkedInAt?: number | null;
  answers: { questionId: string; label: string; answer: string }[];
  linkedinFromAnswers?: string;
  /** True when this person is an organizer of the event, not (only) an attendee. */
  isHost?: boolean;
  hasAnswers: boolean;
  signalTier?: SignalTier;
  syncedAt: number;
}

// One recommended person inside a recipient's five.
export interface ClubRecPerson {
  id: string;
  name: string;
  headline?: string;
  why: string;
  linkedinUrl?: string;
  // Their public Luma profile, shown ONLY when we have no trusted LinkedIn: better
  // a real page with their name and past events than a dead end.
  lumaUrl?: string;
  avatarUrl?: string;
  basis: "mutual" | "coverage";
  score: number;
}

// clubEvents/{eid}/recs/{user_api_id} — the computed five, plus the per-recipient
// send stamps that make a partial blast resumable and a double tick harmless.
export interface ClubRec {
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  eventId: string;
  people: ClubRecPerson[];
  lineSource: "gemini" | "extractive";
  builtAt: number;
  claimedAt?: number;
  emailedAt?: number;
  resendId?: string;
  failedAt?: number;
  error?: string;
  skippedAt?: number;
  skipReason?: string;
}

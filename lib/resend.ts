import { Resend } from "resend";
import { clubUnsubscribeToken } from "@/lib/unsubscribe";
import { siteUrl } from "@/lib/site";

let client: Resend | null = null;

function resend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY?.trim() || process.env.CLUB_RESEND_API_KEY?.trim();
    if (!key) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(key);
  }
  return client;
}

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = "wzhu1997@gmail.com";

function shell(inner: string, footer = "AI Discussion Club") {
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
${inner}
<p style="margin-top:32px;color:#444;font-size:14px">${footer}</p>
</div>`;
}

function button(href: string, label: string, bg = "#1aa64b"): string {
  return `<p style="margin:20px 0"><a href="${href}" style="background:${bg};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;
}

const COPPER = "#6d35a8";

// Escape user-controlled text before interpolating into email HTML.
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

// Validate a user-supplied URL for use in an email href: only http(s), and
// escape it so it can't break out of the attribute. Returns null if unusable.
function safeHref(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return esc(u.toString());
  } catch {
    return null;
  }
}

// --- AI Discussion Club: the pre-event "5 people to meet" email ---------------

// The club sends from its independently verified domain.

const CLUB_FROM = process.env.RESEND_CLUB_FROM ?? "AI Discussion Club <hello@aidiscussionclub.com>";

// The club's public home, used on the title link and the event CTA.
const CLUB_HOME = process.env.CLUB_LUMA_URL ?? "https://luma.com/ai-discussion-club";

// Brand assets use the configured stable site URL.
// These files live in public/club/, so they are served by the app itself: no signed
// URL, no expiry, no storage dependency.
const CLUB_BANNER = `${siteUrl}/brand/banner.png`;
const CLUB_LOGO = `${siteUrl}/brand/logo.png`;

export function assertResendSuccess<T extends {
  data?: { id?: string } | null;
  error?: { message?: string } | null;
}>(result: T): T & { data: { id: string } } {
  if (result.error) throw new Error(result.error.message || "Resend rejected the email.");
  if (!result.data?.id) throw new Error("Resend did not return a message id.");
  return result as T & { data: { id: string } };
}

// Absolute-ise an avatar for email. Stored photos are /api/img/... paths (served by
// the public, immutable-cached proxy); an already-absolute https URL passes through.
function emailImage(src?: string): string | null {
  if (!src) return null;
  return safeHref(src.startsWith("/") ? `${siteUrl}${src}` : src);
}

/**
 * The event name, trimmed for an inbox subject line.
 *
 * Keep only the part before the first colon: "Builder Nights: Show your AI Projects,
 * Learn from the Best Minds in AI" becomes "Builder Nights". Titles here are long
 * enough that "5 people to meet at <full title>" runs past 90 characters, and
 * inboxes cut off between 45 and 70.
 *
 * A " | Speaker" suffix and a trailing parenthetical are stripped first, which only
 * matters for a title with no colon at all (otherwise the colon cut removes them
 * anyway). Whatever survives is capped at 56 chars on a word boundary. The full name
 * is still in the email body twice.
 */
export function subjectEventName(name: string): string {
  let s = (name ?? "").trim();
  s = s.split("|")[0].trim();
  s = s.replace(/\s*\([^)]*\)\s*$/, "").trim();

  const colon = s.indexOf(":");
  if (colon > 0) s = s.slice(0, colon).trim();
  // 56 is calibrated to the real titles: with the speaker suffix and the trailing
  // parenthetical removed, both upcoming events ("Museum Discussion: Product
  // Management in the Age of AI" and "Build with Claude 101: From Idea to Working
  // Prototype") are 53 chars and survive whole. Longer titles get cut rather than
  // pushing the distinguishing words past where an inbox stops rendering.
  if (s.length <= 56) return s;
  const cut = s.slice(0, 56);
  const space = cut.lastIndexOf(" ");
  return `${(space > 30 ? cut.slice(0, space) : cut).replace(/[\s:,;.-]+$/, "")}…`;
}

// The club masthead: banner, then the logo beside the wordmark, linked to the club's
// Luma page.
function clubHeader(): string {
  return `<a href="${CLUB_HOME}" style="text-decoration:none;color:inherit">
<img src="${CLUB_BANNER}" width="560" alt="AI Discussion Club" style="width:100%;max-width:560px;height:auto;border-radius:10px;display:block" />
</a>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 4px">
  <tr>
    <td width="40" valign="middle" style="width:40px;padding-right:10px">
      <a href="${CLUB_HOME}"><img src="${CLUB_LOGO}" width="40" height="40" alt="" style="width:40px;height:40px;border-radius:8px;display:block" /></a>
    </td>
    <td valign="middle">
      <a href="${CLUB_HOME}" style="font-weight:700;font-size:19px;color:#111;text-decoration:none">AI Discussion Club</a>
    </td>
  </tr>
</table>`;
}

export interface ClubMeetPerson {
  name: string;
  headline?: string;
  why: string;
  linkedinUrl?: string; // ONLY when confidence is "given" or "high"
  lumaUrl?: string; // fallback profile link when there is no trusted LinkedIn
  avatarUrl?: string;
}

export interface ClubMeetParams {
  toName: string;
  toEmail: string;
  toId: string; // Luma user_api_id, the unsubscribe token subject
  eventName: string;
  eventWhen: string;
  eventUrl?: string;
  venue?: string;
  people: ClubMeetPerson[];
  test?: boolean; // "send test to me": marks the subject and redirects to the admin
  // Where a TEST copy goes, when not the admin. Lets you show one specific person
  // the email (most usefully their OWN recommendations) without starting a live
  // blast. Ignored unless `test` is set, so it can never redirect a real send.
  testTo?: string;
}

// One person: avatar cell + name/headline/why/LinkedIn, laid out with a table so it
// survives every email client. All user text escaped; the href validated.
function clubRow(m: ClubMeetPerson): string {
  const src = emailImage(m.avatarUrl);
  const avatar = src
    ? `<img src="${src}" width="48" height="48" alt="" style="width:48px;height:48px;border-radius:9999px;object-fit:cover;border:1px solid #e7ded4;display:block" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" style="width:48px;height:48px;border-collapse:separate;border-radius:9999px;background:#f1e8df"><tr><td align="center" valign="middle" style="width:48px;height:48px;color:${COPPER};font-weight:700;font-size:19px;font-family:ui-sans-serif,system-ui,sans-serif">${esc(
        (m.name || "?").trim().charAt(0).toUpperCase() || "?",
      )}</td></tr></table>`;
  // LinkedIn when we trust it, otherwise their Luma profile. Never both: one link
  // per person keeps the row scannable, and LinkedIn is the more useful of the two
  // for deciding whether to walk over and say hello.
  const li = safeHref(m.linkedinUrl);
  const profile = li ? { href: li, label: "LinkedIn" } : (() => {
    const lu = safeHref(m.lumaUrl);
    return lu ? { href: lu, label: "Luma profile" } : null;
  })();
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:14px 0">
  <tr>
    <td width="48" valign="top" style="width:48px;padding-right:14px">${avatar}</td>
    <td valign="top" style="font-size:16px;line-height:1.5">
      <span style="font-weight:600;color:#111">${esc(m.name)}</span>${
        m.headline ? `<span style="color:#555">, ${esc(m.headline)}</span>` : ""
      }${m.why ? `<br /><span style="color:#555;font-size:15px">${esc(m.why)}</span>` : ""}${
        profile
          ? `<br /><a href="${profile.href}" style="color:${COPPER};font-size:14px">${profile.label}</a>`
          : ""
      }
    </td>
  </tr>
</table>`;
}

export function clubRows(people: ClubMeetPerson[]): string {
  return people.map(clubRow).join("");
}

/**
 * The email each confirmed guest gets ~24h before the event: five people who will
 * be in the room and why they are worth finding.
 *
 * Names are plain text, not links: a Luma contact has no club profile, and
 * linking to nothing is worse than not linking. A LinkedIn link appears only when
 * the caller passed one, which happens only at "given" or "high" confidence.
 */
export async function sendClubMeetEmail(p: ClubMeetParams) {
  if (!p.test && process.env.EMAIL_SENDING_ENABLED !== "true") {
    throw new Error("Attendee email sending is disabled.");
  }
  const n = p.people.length;
  const unsubToken = clubUnsubscribeToken(p.toId);
  const unsubUrl = unsubToken ? `${BASE}/api/club-unsubscribe?t=${unsubToken}` : null;
  const eventLink = safeHref(p.eventUrl);

  const inner = `
${clubHeader()}
<p style="margin:0;color:#555">${esc(p.eventName)}<br />${esc(p.eventWhen)}${p.venue ? ` · ${esc(p.venue)}` : ""}</p>

<p style="margin-top:24px">Hi ${esc(p.toName.split(" ")[0] || "there")},</p>

<p>${
    n === 1 ? "Here is 1 person" : `Here are ${n} people`
  } worth meeting at your next event. Feel free to connect with them.</p>

${clubRows(p.people)}
${eventLink ? button(eventLink, "See the event details", COPPER) : ""}
<p style="color:#444;font-size:14px">Not sure who to approach first? Start with whoever is standing alone.</p>
${
  unsubUrl
    ? `<p style="color:#888;font-size:13px;margin-top:8px">Don&apos;t want these before each event? <a href="${unsubUrl}" style="color:#888">Unsubscribe</a>.</p>`
    : ""
}`;

  // Name the actual event, not the club: "5 people to meet at Museum Discussion:
  // Product Management…" tells someone which night this is about at a glance, which
  // a generic club subject cannot. Falls back to the club name for an unnamed event.
  const where = subjectEventName(p.eventName) || "the AI Discussion Club";
  const subject = `${p.test ? "[test] " : ""}${n} ${n === 1 ? "person" : "people"} to meet at ${where}`;

  const result = await resend().emails.send({
    from: CLUB_FROM,
    to: [p.test ? (p.testTo?.trim() || ADMIN_EMAIL) : p.toEmail],
    replyTo: [ADMIN_EMAIL],
    subject,
    html: shell(
      p.test
        ? `<p style="margin:0 0 16px;padding:10px 12px;background:#f1e8df;border-radius:8px;font-size:14px;color:#444">${
            (p.testTo ?? "").trim().toLowerCase() === p.toEmail.trim().toLowerCase()
              ? "Preview of what you would receive before an event. Nothing has been sent to anyone else."
              : `Test copy. The real recipient would be ${esc(p.toName)} &lt;${esc(p.toEmail)}&gt;.`
          }</p>${inner}`
        : inner,
      `<a href="${CLUB_HOME}" style="color:#444">AI Discussion Club</a> · you are getting this because you are registered for this event.`,
    ),
    ...(unsubUrl && !p.test
      ? {
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  });
  return assertResendSuccess(result);
}

export interface ClubPreviewParams {
  eventName: string;
  eventWhen: string;
  eventId: string;
  sendsAt: string;
  counts: {
    approved: number;
    recipients: number;
    withLinkedIn: number;
    zeroSignal: number;
    geminiFallbacks: number;
    shortLists?: number;
    exaCalls: number;
    optedOut: number;
  };
  sample: ClubMeetParams;
}

/**
 * The admin preview, sent the moment prepare finishes (T-48h).
 *
 * The cancel deadline goes in the SUBJECT so it survives a glance on a phone, and
 * the body carries one real recipient's email rendered inline rather than a summary
 * of it: the only reliable way to catch a bad batch is to read the actual thing.
 */
export async function sendClubPreviewEmail(p: ClubPreviewParams) {
  const c = p.counts;
  const stat = (label: string, value: string | number) =>
    `<tr><td style="padding:2px 12px 2px 0;color:#555;font-size:14px">${esc(label)}</td><td style="padding:2px 0;font-weight:600;font-size:14px">${esc(
      String(value),
    )}</td></tr>`;

  // A degraded batch (many thin lists, or a large share who told us nothing) usually
  // means enrichment has not caught up with the guest list. Flag it at the top so a
  // weak blast is caught in the preview instead of after it lands.
  const shortLists = c.shortLists ?? 0;
  const degraded =
    c.recipients > 0 && (shortLists / c.recipients > 0.2 || c.zeroSignal / c.recipients > 0.4);
  const banner = degraded
    ? `<div style="background:#fbeaea;border:1px solid #e6b3b3;border-radius:10px;padding:12px 14px;margin:0 0 16px;color:#7a1f1f;font-size:14px">
<strong>Heads up: this batch looks thin.</strong> ${esc(String(shortLists))} of ${esc(
        String(c.recipients),
      )} recipients got fewer than five people, and ${esc(String(c.zeroSignal))} told us nothing about themselves. Enrichment may not have caught up with the guest list. Consider running enrichment and re-preparing before this goes out.</div>`
    : "";

  const inner = `
${clubHeader()}
${banner}
<p style="margin:0 0 4px;font-weight:600">Blast ready.</p>
<p style="margin:0;color:#555">${esc(p.eventName)}<br />${esc(p.eventWhen)}</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px">
${stat("Confirmed guests", c.approved)}
${stat("Will be emailed", c.recipients)}
${stat("With a LinkedIn link", c.withLinkedIn)}
${stat("Told us nothing", c.zeroSignal)}
${stat("Got fewer than five", shortLists)}
${stat("Opted out", c.optedOut)}
${stat("Fell back to their own words", c.geminiFallbacks)}
${stat("Exa lookups this run", c.exaCalls)}
</table>

<p style="margin-top:20px">Goes out <strong>${esc(p.sendsAt)}</strong> unless you cancel it.</p>
${button(`${BASE}/admin?event=${encodeURIComponent(p.eventId)}`, "Review or cancel the blast", COPPER)}

<p style="margin-top:28px;color:#555;font-size:14px">Below is one real recipient's email, exactly as they will read it.</p>
<div style="border:1px solid #e7ded4;border-radius:10px;padding:16px;margin-top:8px">
<p style="margin:0 0 4px;font-weight:700;font-size:17px"><a href="${CLUB_HOME}" style="color:#111;text-decoration:none">AI Discussion Club</a></p>
<p style="margin:0 0 14px;color:#555;font-size:14px">To ${esc(p.sample.toName)} &lt;${esc(p.sample.toEmail)}&gt;</p>
${clubRows(p.sample.people)}
</div>`;

  const result = await resend().emails.send({
    from: CLUB_FROM,
    to: [ADMIN_EMAIL],
    replyTo: [ADMIN_EMAIL],
    subject: `[AI Discussion Club] ${c.recipients} emails ready, going out ${p.sendsAt}. Cancel by then.`,
    html: shell(inner, "AI Discussion Club · admin preview"),
  });
  return assertResendSuccess(result);
}

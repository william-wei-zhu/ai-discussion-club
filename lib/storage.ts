import { randomUUID } from "crypto";
import { uploadBucket } from "@/lib/firebase-admin";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Upload an image to GCS under the given prefix and return its storage key.
// Served back to the client through /api/img/<key>.
async function uploadImage(
  prefix: "posts" | "avatars",
  uid: string,
  file: { type: string; bytes: Buffer },
): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new Error("Only JPG, PNG, WebP, or GIF images.");
  if (file.bytes.length > MAX_BYTES) throw new Error("Image must be under 5 MB.");

  const key = `${prefix}/${uid}/${randomUUID()}.${ext}`;
  await uploadBucket().file(key).save(file.bytes, {
    contentType: file.type,
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000, immutable" },
  });
  return key;
}

export function uploadPostImage(uid: string, file: { type: string; bytes: Buffer }) {
  return uploadImage("posts", uid, file);
}

export function uploadAvatar(uid: string, file: { type: string; bytes: Buffer }) {
  return uploadImage("avatars", uid, file);
}

// Remove a replaced avatar. Takes the stored /api/img/avatars/... path; anything
// else is ignored, and a missing object is not an error.
export async function deleteStoredImage(path: string | undefined): Promise<void> {
  const key = path?.startsWith("/api/img/") ? path.slice("/api/img/".length) : "";
  if (!/^avatars\/[A-Za-z0-9._-]+\/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/.test(key)) return;
  await uploadBucket().file(key).delete({ ignoreNotFound: true }).catch(() => {});
}

// Only import images from LinkedIn's media CDN (the source of onboarding avatar
// guesses via Exa og:image). A tight host allowlist keeps this from being an
// SSRF vector when the URL originates from a request body.
function isAllowedAvatarHost(url: URL): boolean {
  return url.protocol === "https:" && /(^|\.)licdn\.com$/.test(url.hostname);
}

// Best-effort import of an external avatar URL (a LinkedIn profile photo) into
// our GCS avatars bucket, returning its storage key (served via /api/img/<key>).
// Returns null on any problem (bad host, non-image, too big, fetch error) so the
// caller can fall back to no photo without failing the save.
export async function importAvatarFromUrl(uid: string, rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isAllowedAvatarHost(url)) return null;

  try {
    // Follow redirects manually so a licdn.com URL that 302s off-host can't be
    // used to fetch from an unvetted host (redirect:"follow" only validates the
    // initial URL). Every hop must stay on the licdn allowlist.
    let res: Response | null = null;
    let target = url;
    for (let hop = 0; hop <= 3; hop++) {
      if (!isAllowedAvatarHost(target)) return null;
      res = await fetch(target, { signal: AbortSignal.timeout(5000), redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        await res.body?.cancel().catch(() => {});
        try {
          target = new URL(loc, target);
        } catch {
          return null;
        }
        continue;
      }
      break;
    }
    if (!res || res.status >= 300 || !res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!EXT[type]) return null; // only jpg/png/webp/gif
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
    return await uploadAvatar(uid, { type, bytes });
  } catch {
    return null;
  }
}

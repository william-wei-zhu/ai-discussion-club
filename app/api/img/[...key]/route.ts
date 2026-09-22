import { NextResponse } from "next/server";
import { uploadBucket } from "@/lib/firebase-admin";

// GET: stream a post image or avatar from the private GCS bucket (so the bucket
// stays non-public). Only the posts/ and avatars/ prefixes are served. Cached
// aggressively (keys are immutable UUIDs).
//
// NOTE (by design): this proxy is UNAUTHENTICATED — it must be, so avatars and
// public-post images render for logged-out visitors and inline into OG cards.
// Consequently a connection-only / group-only post's IMAGE is protected only by
// its unguessable UUID key (a capability URL), not by the post's visibility
// allowlist. The post TEXT is fully gated; the image bytes rest on URL secrecy.
// If connection-only images ever need true access control, resolve the owning
// post from the key here and enforce postVisibleTo for authenticated viewers.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const path = key.join("/");
  const allowed = path.startsWith("posts/") || path.startsWith("avatars/");
  if (!allowed || path.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = uploadBucket().file(path);
  const [exists] = await file.exists();
  if (!exists) return new NextResponse("Not found", { status: 404 });

  const [buf] = await file.download();
  const [meta] = await file.getMetadata();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": meta.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      // Upload trusts the client-declared MIME (no magic-byte check), so forbid
      // the browser from sniffing a spoofed image/* into an executable type.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

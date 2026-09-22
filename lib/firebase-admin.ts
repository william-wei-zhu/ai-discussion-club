import {
  getApps,
  initializeApp,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import jwt from "jsonwebtoken";

// NOTE: we deliberately do NOT import "firebase-admin/auth". It pulls in
// jwks-rsa -> jose (ESM-only), which can't be require()'d in Vercel's serverless
// runtime (ERR_REQUIRE_ESM). We verify ID tokens with jsonwebtoken (CJS) instead.

// This service is intentionally pinned to its own project. Never infer a project
// from Vertex or the ambient gcloud default: either could point at another app.
export const PROJECT_ID = "ai-discussion-club-260922";

let app: App | null = null;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    if (json.project_id !== PROJECT_ID) {
      throw new Error(`Firebase service account project must be ${PROJECT_ID}.`);
    }
    app = initializeApp({ credential: cert(json), projectId: PROJECT_ID });
  } else {
    app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  return app;
}

export function db(): Firestore {
  return getFirestore(adminApp());
}

// GCS bucket for user-uploaded post images. Private bucket; objects are served
// through our /api/img proxy (no public IAM), so the SA just needs read/write.
const UPLOAD_BUCKET = process.env.GCS_UPLOAD_BUCKET ?? "ai-discussion-club-260922-uploads";

export function uploadBucket() {
  return getStorage(adminApp()).bucket(UPLOAD_BUCKET);
}

// --- Mint Firebase custom tokens without firebase-admin/auth ---
// A Firebase custom token is just a JWT signed with the service account key.
// We sign it with jsonwebtoken (CJS) for the same ESM-avoidance reason as above.
// Used by the LinkedIn sign-in flow: LinkedIn's OIDC token endpoint only accepts
// client_secret in the POST body (client_secret_post), which Google Identity
// Platform's native OIDC provider won't do, so we exchange the code server-side
// and hand the user a custom token instead.

const CUSTOM_TOKEN_AUD =
  "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

let serviceAccount: { client_email: string; private_key: string } | null = null;

function serviceAccountKey() {
  if (serviceAccount) return serviceAccount;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_B64 is required to mint custom tokens (LinkedIn sign-in).",
    );
  }
  serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  return serviceAccount!;
}

// `claims` become custom claims, which Firebase surfaces as top-level fields in
// the issued ID token — so passing { email } lets verifyRequest() see the email
// for a LinkedIn user just like it does for Google/email sign-in.
export function createCustomToken(
  uid: string,
  claims?: Record<string, unknown>,
): string {
  const sa = serviceAccountKey();
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: CUSTOM_TOKEN_AUD,
    iat: now,
    exp: now + 3600, // Firebase caps custom tokens at 1 hour
    uid,
  };
  if (claims && Object.keys(claims).length) payload.claims = claims;
  return jwt.sign(payload, sa.private_key, { algorithm: "RS256" });
}

// --- Firebase ID token verification without firebase-admin/auth ---

const CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: { keys: Record<string, string>; expires: number } | null = null;

async function googleCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() < certCache.expires) return certCache.keys;
  const res = await fetch(CERT_URL);
  const keys = (await res.json()) as Record<string, string>;
  // Honor cache-control max-age so we refresh when Google rotates keys.
  const cc = res.headers.get("cache-control") ?? "";
  const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] ?? 3600);
  certCache = { keys, expires: Date.now() + maxAge * 1000 };
  return keys;
}

export async function verifyRequest(
  req: Request,
): Promise<{ uid: string; email: string } | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  try {
    const decoded = jwt.decode(token, { complete: true });
    const kid = decoded?.header?.kid;
    if (!kid) return null;
    const certs = await googleCerts();
    const pem = certs[kid];
    if (!pem) return null;

    const payload = jwt.verify(token, pem, {
      algorithms: ["RS256"],
      audience: PROJECT_ID,
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    }) as jwt.JwtPayload;

    const email = (payload.email as string | undefined)?.toLowerCase();
    const uid = (payload.user_id as string) ?? payload.sub;
    if (!email || !uid) return null;
    // Require a VERIFIED email. Identity (the person doc lookup) and chat's
    // memberAuthUids read-rule bridge are both keyed on email, so an unverified
    // email must never be accepted as proof of identity. Google + email-link
    // tokens are always verified; LinkedIn custom tokens carry our normalized
    // email_verified claim (see app/api/auth/linkedin/callback).
    if (payload.email_verified !== true) return null;
    return { uid, email };
  } catch {
    return null;
  }
}

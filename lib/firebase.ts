"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;

export function firebaseApp(): FirebaseApp {
  if (!firebaseConfigured()) throw new Error("Firebase client configuration is incomplete.");
  if (!app) app = getApps().length ? getApps()[0] : initializeApp(config);
  return app;
}

export function auth(): Auth {
  return getAuth(firebaseApp());
}

// Client Firestore — used ONLY for realtime chat READS (onSnapshot), gated by
// security rules (firestore.rules). All writes stay server-mediated via the admin
// SDK in API routes; the deny-all write rules keep the client read-only.
export function firestore(): Firestore {
  return getFirestore(firebaseApp());
}

export const googleProvider = new GoogleAuthProvider();

// LinkedIn is NOT a Firebase provider here: its OIDC token endpoint only accepts
// client_secret in the POST body, which Firebase's native OIDC provider won't do.
// Sign-in instead runs through /api/auth/linkedin/* (server code exchange) and
// completes with signInWithCustomToken. See docs/linkedin-signin-setup.md.

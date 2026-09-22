"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

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

export const googleProvider = new GoogleAuthProvider();

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function privateKey() {
  return env("FIREBASE_PRIVATE_KEY").replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

export function hasFirebaseConfig() {
  return Boolean(env("FIREBASE_PROJECT_ID") && env("FIREBASE_CLIENT_EMAIL") && privateKey());
}

export function firestore() {
  if (!hasFirebaseConfig()) {
    throw new Error("Firebase environment variables are not configured");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env("FIREBASE_PROJECT_ID"),
        clientEmail: env("FIREBASE_CLIENT_EMAIL"),
        privateKey: privateKey(),
      }),
    });
  }

  return getFirestore();
}

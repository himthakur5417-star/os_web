import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type Auth,
  type User
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCjC7CXHnESi9GBXNrxiN2PkLLVne-w3k4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "os-web-1cc80.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "os-web-1cc80",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "os-web-1cc80.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "754661334425",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:754661334425:web:0279cb6123fa8dc4974708",
};

// Client-side instances
var app: FirebaseApp | null = null;
var auth: Auth | null = null;
var googleProvider: GoogleAuthProvider | null = null;
var db: Firestore | null = null;

// Safe lazy getter functions (prevents lexical TDZ and SSR crashes)
export function getFirebaseApp(): FirebaseApp | null {
  try {
    if (app) return app;
    const instance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    if (typeof window !== "undefined") {
      app = instance;
    }
    return instance;
  } catch (e) {
    console.warn("Firebase App init warning:", e);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  try {
    if (auth) return auth;
    const a = getFirebaseApp();
    if (!a) return null;
    const aAuth = getAuth(a);
    if (typeof window !== "undefined") {
      auth = aAuth;
      setPersistence(aAuth, browserLocalPersistence).catch(() => {});
    }
    return aAuth;
  } catch (e) {
    console.warn("Firebase Auth init warning:", e);
    return null;
  }
}

export function getFirestoreDb(): Firestore | null {
  try {
    if (db) return db;
    const a = getFirebaseApp();
    const instance = a ? getFirestore(a) : null;
    if (typeof window !== "undefined" && instance) {
      db = instance;
    }
    return instance;
  } catch (e) {
    console.warn("Firestore init warning:", e);
    return null;
  }
}

export function getGoogleProvider(): GoogleAuthProvider | null {
  try {
    if (googleProvider) return googleProvider;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    provider.addScope("email");
    provider.addScope("profile");
    if (typeof window !== "undefined") {
      googleProvider = provider;
    }
    return provider;
  } catch (e) {
    return null;
  }
}

if (typeof window !== "undefined") {
  try {
    app = getFirebaseApp();
    auth = getFirebaseAuth();
    googleProvider = getGoogleProvider();
    db = getFirestoreDb();
  } catch (e) {
    console.warn("Firebase client fallback:", e);
  }
}

export {
  app,
  auth,
  db,
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type Auth,
  type User
};

// Firebase wiring shared by every page. The web config is public by design; the
// Firestore rules (firestore.rules) are what protect the data.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
export {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, onSnapshot, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBDIT_UIh1TtSZSbeGbsAVAdXA2HedfNi0",
  authDomain: "kangaroo-bingo.firebaseapp.com",
  projectId: "kangaroo-bingo",
  storageBucket: "kangaroo-bingo.firebasestorage.app",
  messagingSenderId: "227149337489",
  appId: "1:227149337489:web:253b5ce0dbdd0672f64030"
});

export const auth = getAuth(app);

let cache;
try { cache = persistentLocalCache({ tabManager: persistentMultipleTabManager() }); } catch (e) { cache = undefined; }
export const db = initializeFirestore(app, cache ? { localCache: cache } : {});

// Resolve the persisted anonymous user, or create one. Same browser = same card.
export async function signIn() {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

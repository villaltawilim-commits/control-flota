import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fsLimit,
  serverTimestamp,
  Timestamp,
  runTransaction,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  fsLimit,
  serverTimestamp,
  Timestamp,
  runTransaction,
  writeBatch,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
};

/**
 * Creates a new Firebase Auth user WITHOUT signing the browser in as them,
 * so an already-authenticated admin keeps their own session. Uses the public
 * Identity Toolkit REST API directly (the same apiKey already shipped to the
 * client is required for every Firebase Auth call anyway).
 */
export async function adminCreateAuthUser(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || "No se pudo crear el usuario.";
    throw new Error(mapAuthError(message));
  }
  return data.localId; // new user's UID
}

function mapAuthError(code) {
  const map = {
    EMAIL_EXISTS: "Ya existe un usuario con este correo.",
    INVALID_EMAIL: "Correo inválido.",
    WEAK_PASSWORD: "La contraseña es muy débil (mínimo 6 caracteres).",
  };
  return map[code] || code;
}

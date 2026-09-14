import { auth, db, onAuthStateChanged, doc, onSnapshot } from "./firebase.js";

const listeners = new Set();

export const state = {
  ready: false, // has the initial auth check completed
  user: null, // Firebase Auth user
  profile: null, // Firestore users/{uid} doc data (includes flat `permissions` map)
};

let profileUnsub = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

onAuthStateChanged(auth, (user) => {
  if (profileUnsub) {
    profileUnsub();
    profileUnsub = null;
  }

  if (!user) {
    state.ready = true;
    state.user = null;
    state.profile = null;
    notify();
    return;
  }

  state.user = user;
  profileUnsub = onSnapshot(
    doc(db, "users", user.uid),
    (snap) => {
      state.profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      state.ready = true;
      notify();
    },
    () => {
      state.profile = null;
      state.ready = true;
      notify();
    }
  );
});

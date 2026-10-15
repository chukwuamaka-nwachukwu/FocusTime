
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db, ensureAnonymousUser } from "../firebase/firebase";

const DEFAULT_PREFERENCES = {
  sessionMinutes: 25,
};

async function getUserRef() {
  const user = await ensureAnonymousUser();

  if (!user?.uid) {
    throw new Error("Firebase anonymous authentication is not ready.");
  }

  return {
    user,
    userRef: doc(db, "users", user.uid),
  };
}

async function getPreferencesRef() {
  const { userRef } = await getUserRef();

  return doc(userRef, "settings", "preferences");
}

async function getActiveSessionRef() {
  const { userRef } = await getUserRef();

  return doc(userRef, "state", "activeSession");
}

// -----------------------------
// DURATION PREFERENCES
// -----------------------------

export async function loadFocusPreferences() {
  const preferencesRef = await getPreferencesRef();
  const snapshot = await getDoc(preferencesRef);

  if (!snapshot.exists()) {
    await setDoc(preferencesRef, {
      ...DEFAULT_PREFERENCES,
      updatedAt: serverTimestamp(),
    });

    return DEFAULT_PREFERENCES;
  }

  const data = snapshot.data();
  const minutes = Number(data.sessionMinutes);

  return {
    sessionMinutes:
      Number.isInteger(minutes) &&
      minutes >= 1 &&
      minutes <= 180
        ? minutes
        : DEFAULT_PREFERENCES.sessionMinutes,
  };
}

export async function saveFocusPreferences(sessionMinutes) {
  const minutes = Number(sessionMinutes);

  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 180
  ) {
    throw new Error("Duration must be between 1 and 180 minutes.");
  }

  const preferencesRef = await getPreferencesRef();

  await setDoc(
    preferencesRef,
    {
      sessionMinutes: minutes,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// -----------------------------
// COMPLETED FOCUS SESSIONS
// -----------------------------

export async function saveFocusSession({
  id,
  sessionId,
  taskName,
  plannedMinutes,
  actualFocusedSeconds,
  startedAt,
  completedAt,
}) {
  const { user, userRef } = await getUserRef();

  // Reuse the session ID when retrying a save.
  // This prevents duplicate history records.
  const stableId =
    sessionId || id || `${Date.now()}-${user.uid}`;

  const minutes = Number(plannedMinutes);
  const focusedSeconds = Number(actualFocusedSeconds);

  if (
    !Number.isFinite(minutes) ||
    minutes < 1 ||
    !Number.isFinite(focusedSeconds) ||
    focusedSeconds < 0
  ) {
    throw new Error("The focus session contains invalid duration data.");
  }

  const sessionRef = doc(
    collection(userRef, "focusSessions"),
    stableId
  );

  const session = {
    uid: user.uid,
    taskName: String(
      taskName || "Untitled focus task"
    ).trim(),
    plannedMinutes: minutes,
    actualFocusedSeconds: focusedSeconds,
    startedAt: startedAt || new Date().toISOString(),
    completedAt: completedAt || new Date().toISOString(),
    status: "completed",
    createdAt: serverTimestamp(),
  };

  // setDoc with a stable document ID makes retries safe.
  await setDoc(sessionRef, session, { merge: true });

  return {
    id: stableId,
    ...session,
  };
}

export async function loadFocusHistory() {
  const { userRef } = await getUserRef();
  const sessionsRef = collection(userRef, "focusSessions");

  const historyQuery = query(
    sessionsRef,
    orderBy("completedAt", "desc"),
    limit(100)
  );

  const snapshot = await getDocs(historyQuery);

  return snapshot.docs.map((item) => {
    const data = item.data();

    const normalizeDate = (value) => {
      if (!value) return null;

      if (typeof value.toDate === "function") {
        return value.toDate().toISOString();
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      return value;
    };

    return {
      ...data,
      id: item.id,
      startedAt: normalizeDate(data.startedAt),
      completedAt: normalizeDate(data.completedAt),
    };
  });
}

// -----------------------------
// ACTIVE TIMER STATE
// -----------------------------

export async function saveActiveFocusSession(session) {
  if (!session?.sessionId) {
    throw new Error("An active session ID is required.");
  }

  const activeSessionRef = await getActiveSessionRef();

  await setDoc(
    activeSessionRef,
    {
      ...session,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function loadActiveFocusSession() {
  const activeSessionRef = await getActiveSessionRef();
  const snapshot = await getDoc(activeSessionRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data();
}

export async function clearActiveFocusSession() {
  const activeSessionRef = await getActiveSessionRef();

  await deleteDoc(activeSessionRef);
}

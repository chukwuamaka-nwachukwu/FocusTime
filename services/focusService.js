
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
  Timestamp,
} from "firebase/firestore";

import {
  db,
  ensureAnonymousUser,
} from "../firebase/firebase";

// =====================================================
// DEFAULTS
// =====================================================

const DEFAULT_PREFERENCES = {
  sessionMinutes: 25,
};

// =====================================================
// USER REFERENCES
// =====================================================

async function getUserRef() {
  const user = await ensureAnonymousUser();

  if (!user?.uid) {
    throw new Error(
      "Firebase authentication is not ready. Please try again."
    );
  }

  return {
    user,
    userRef: doc(db, "users", user.uid),
  };
}

async function getPreferencesRef() {
  const { userRef } = await getUserRef();

  return doc(
    userRef,
    "settings",
    "preferences"
  );
}

async function getActiveSessionRef() {
  const { userRef } = await getUserRef();

  return doc(
    userRef,
    "state",
    "activeSession"
  );
}

// =====================================================
// HELPERS
// =====================================================

function normalizeDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function toFirestoreTimestamp(value) {
  const normalized = normalizeDate(value);

  if (!normalized) {
    throw new Error("A valid date is required.");
  }

  return Timestamp.fromDate(
    new Date(normalized)
  );
}

function validateMinutes(value) {
  const minutes = Number(value);

  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 180
  ) {
    throw new Error(
      "Duration must be a whole number between 1 and 180 minutes."
    );
  }

  return minutes;
}

// =====================================================
// DURATION PREFERENCES
// =====================================================

export async function loadFocusPreferences() {
  const preferencesRef =
    await getPreferencesRef();

  const snapshot = await getDoc(
    preferencesRef
  );

  if (!snapshot.exists()) {
    await setDoc(preferencesRef, {
      ...DEFAULT_PREFERENCES,
      updatedAt: serverTimestamp(),
    });

    return DEFAULT_PREFERENCES;
  }

  const data = snapshot.data();

  let sessionMinutes;

  try {
    sessionMinutes = validateMinutes(
      data.sessionMinutes
    );
  } catch {
    sessionMinutes =
      DEFAULT_PREFERENCES.sessionMinutes;
  }

  return {
    sessionMinutes,
  };
}

export async function saveFocusPreferences(
  sessionMinutes
) {
  const minutes = validateMinutes(
    sessionMinutes
  );

  const { user, userRef } =
    await getUserRef();

  const preferencesRef = doc(
    userRef,
    "settings",
    "preferences"
  );

  await setDoc(
    preferencesRef,
    {
      userId: user.uid,
      sessionMinutes: minutes,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

// =====================================================
// COMPLETED FOCUS SESSIONS
// =====================================================

export async function saveFocusSession({
  id,
  sessionId,
  taskName,
  plannedMinutes,
  actualFocusedSeconds,
  startedAt,
  completedAt,
}) {
  const { user, userRef } =
    await getUserRef();

  const stableId = String(
    sessionId || id || ""
  ).trim();

  if (!stableId) {
    throw new Error(
      "A session ID is required to save focus history."
    );
  }

  const minutes = validateMinutes(
    plannedMinutes
  );

  const focusedSeconds = Number(
    actualFocusedSeconds
  );

  if (
    !Number.isFinite(focusedSeconds) ||
    focusedSeconds < 0
  ) {
    throw new Error(
      "The focused duration is invalid."
    );
  }

  const startedTimestamp =
    toFirestoreTimestamp(startedAt);

  const completedTimestamp =
    toFirestoreTimestamp(completedAt);

  const sessionsRef = collection(
    userRef,
    "focusSessions"
  );

  // Stable ID prevents duplicate records on retry.
  const sessionRef = doc(
    sessionsRef,
    stableId
  );

  await setDoc(
    sessionRef,
    {
      id: stableId,
      sessionId: stableId,
      userId: user.uid,
      taskName:
        String(
          taskName || "Untitled focus task"
        ).trim() ||
        "Untitled focus task",
      plannedMinutes: minutes,
      actualFocusedSeconds: Math.floor(
        focusedSeconds
      ),
      startedAt: startedTimestamp,
      completedAt: completedTimestamp,
      status: "completed",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: stableId,
    sessionId: stableId,
    saved: true,
  };
}

export async function loadFocusHistory() {
  const { userRef } = await getUserRef();

  const sessionsRef = collection(
    userRef,
    "focusSessions"
  );

  const historyQuery = query(
    sessionsRef,
    orderBy("completedAt", "desc"),
    limit(100)
  );

  const snapshot = await getDocs(
    historyQuery
  );

  return snapshot.docs.map((item) => {
    const data = item.data();

    return {
      ...data,
      id: item.id,
      sessionId:
        data.sessionId || item.id,
      startedAt: normalizeDate(
        data.startedAt
      ),
      completedAt: normalizeDate(
        data.completedAt
      ),
    };
  });
}

// =====================================================
// ACTIVE TIMER STATE
// =====================================================

export async function saveActiveFocusSession(
  session
) {
  if (!session?.sessionId) {
    throw new Error(
      "An active session ID is required."
    );
  }

  const minutes = validateMinutes(
    session.plannedMinutes
  );

  const remainingSeconds = Math.max(
    0,
    Math.floor(
      Number(session.remainingSeconds) || 0
    )
  );

  if (
    !["running", "paused"].includes(
      session.status
    )
  ) {
    throw new Error(
      "Active session status must be running or paused."
    );
  }

  const { user, userRef } =
    await getUserRef();

  const activeSessionRef = doc(
    userRef,
    "state",
    "activeSession"
  );

  await setDoc(
    activeSessionRef,
    {
      userId: user.uid,
      sessionId: String(session.sessionId),
      taskName:
        String(
          session.taskName ||
            "Untitled focus task"
        ).trim() ||
        "Untitled focus task",
      plannedMinutes: minutes,
      remainingSeconds,
      status: session.status,
      startedAt: normalizeDate(
        session.startedAt
      ),
      endAt: normalizeDate(
        session.endAt
      ),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

export async function loadActiveFocusSession() {
  const activeSessionRef =
    await getActiveSessionRef();

  const snapshot = await getDoc(
    activeSessionRef
  );

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    ...data,
    startedAt: normalizeDate(
      data.startedAt
    ),
    endAt: normalizeDate(
      data.endAt
    ),
  };
}

export async function clearActiveFocusSession() {
  const activeSessionRef =
    await getActiveSessionRef();

  await deleteDoc(activeSessionRef);

  return true;
}

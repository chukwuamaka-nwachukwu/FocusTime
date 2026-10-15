
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { ProgressBar } from "react-native-paper";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";

import { colors } from "../utils/colors";

import {
  loadFocusPreferences,
  saveFocusPreferences,
  saveFocusSession,
  loadFocusHistory,
  saveActiveFocusSession,
  loadActiveFocusSession,
  clearActiveFocusSession,
} from "../../services/focusService.js";

const DURATION_OPTIONS = [5, 10, 15, 25, 30, 45, 60];
const DEFAULT_MINUTES = 25;
const KEEP_AWAKE_TAG = "focus-timer";

const formatTime = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
};

const formatDate = (value) => {
  if (!value) return "Date unavailable";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const createSessionId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const Timer = ({
  focusSubject,
  clearSubject,
  onTimerEnd,
}) => {
  const [sessionMinutes, setSessionMinutes] =
    useState(DEFAULT_MINUTES);

  const [secondsLeft, setSecondsLeft] =
    useState(DEFAULT_MINUTES * 60);

  const [customMinutes, setCustomMinutes] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [restoredTaskName, setRestoredTaskName] = useState("");

  const mountedRef = useRef(false);
  const startedAtRef = useRef(null);
  const endAtRef = useRef(null);
  const sessionIdRef = useRef(null);
  const savedSessionRef = useRef(false);
  const pendingSessionRef = useRef(null);

  const completionSound = useAudioPlayer(
    require("../../assets/focus-time.mp3")
  );

  const taskName =
    focusSubject?.trim() ||
    restoredTaskName ||
    "Untitled focus task";

  const totalSeconds = sessionMinutes * 60;

  const progress =
    totalSeconds > 0
      ? Math.min(
          1,
          Math.max(
            0,
            (totalSeconds - secondsLeft) / totalSeconds
          )
        )
      : 0;

  // -----------------------------
  // KEEP SCREEN AWAKE ONLY WHILE RUNNING
  // -----------------------------

  useEffect(() => {
    if (isStarted && !isComplete) {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(
        (error) => {
          console.warn(
            "Could not keep the screen awake:",
            error
          );
        }
      );
    } else {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    }

    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [isStarted, isComplete]);

  // -----------------------------
  // REFRESH HISTORY
  // -----------------------------

  const refreshHistory = useCallback(async () => {
    const records = await loadFocusHistory();

    if (mountedRef.current) {
      setHistory(records);
    }

    return records;
  }, []);

  const handleRefreshHistory = useCallback(async () => {
    try {
      await refreshHistory();

      if (mountedRef.current) {
        setErrorMessage("");
      }
    } catch (error) {
      console.error("Could not refresh focus history:", error);

      if (mountedRef.current) {
        setErrorMessage(
          "Your history could not refresh. Your previously loaded records are still available."
        );
      }
    }
  }, [refreshHistory]);

  // -----------------------------
  // INITIALIZE CLOUD DATA
  // -----------------------------

  useEffect(() => {
    mountedRef.current = true;

    const initialize = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const [preferences, records, activeSession] =
          await Promise.all([
            loadFocusPreferences(),
            loadFocusHistory(),
            loadActiveFocusSession(),
          ]);

        if (!mountedRef.current) return;

        const savedMinutes = Number(
          preferences?.sessionMinutes
        );

        const validMinutes =
          Number.isInteger(savedMinutes) &&
          savedMinutes >= 1 &&
          savedMinutes <= 180
            ? savedMinutes
            : DEFAULT_MINUTES;

        setSessionMinutes(validMinutes);
        setSecondsLeft(validMinutes * 60);
        setHistory(records);

        if (
          activeSession?.sessionId &&
          ["running", "paused"].includes(activeSession.status)
        ) {
          const restoredMinutes = Number(
            activeSession.plannedMinutes
          );

          const validRestoredMinutes =
            Number.isInteger(restoredMinutes) &&
            restoredMinutes >= 1 &&
            restoredMinutes <= 180
              ? restoredMinutes
              : validMinutes;

          let restoredRemaining;

          if (
            activeSession.status === "running" &&
            activeSession.endAt
          ) {
            const endTimestamp = new Date(
              activeSession.endAt
            ).getTime();

            restoredRemaining = Number.isFinite(endTimestamp)
              ? Math.max(
                  0,
                  Math.ceil(
                    (endTimestamp - Date.now()) / 1000
                  )
                )
              : 0;
          } else {
            restoredRemaining = Math.max(
              0,
              Number(activeSession.remainingSeconds) || 0
            );
          }

          setSessionMinutes(validRestoredMinutes);
          setSecondsLeft(restoredRemaining);
          setRestoredTaskName(
            activeSession.taskName || ""
          );

          startedAtRef.current =
            activeSession.startedAt ||
            new Date().toISOString();

          sessionIdRef.current = activeSession.sessionId;
          savedSessionRef.current = false;

          if (activeSession.status === "running") {
            const restoredEndAt = new Date(
              activeSession.endAt
            ).getTime();

            endAtRef.current = Number.isFinite(restoredEndAt)
              ? restoredEndAt
              : Date.now();

            setIsStarted(true);
          } else {
            endAtRef.current = null;
            setIsStarted(false);
          }
        }
      } catch (error) {
        console.error(
          "FocusTime initialization failed:",
          error
        );

        if (mountedRef.current) {
          setErrorMessage(
            "Could not load your cloud data. Check your internet connection and Firebase configuration."
          );
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -----------------------------
  // COUNTDOWN
  // -----------------------------

  useEffect(() => {
    if (!isStarted) return undefined;

    const updateRemaining = () => {
      if (!endAtRef.current) return;

      const remaining = Math.max(
        0,
        Math.ceil(
          (endAtRef.current - Date.now()) / 1000
        )
      );

      setSecondsLeft((previous) =>
        previous === remaining ? previous : remaining
      );
    };

    updateRemaining();

    const interval = setInterval(updateRemaining, 500);

    return () => clearInterval(interval);
  }, [isStarted]);

  // -----------------------------
  // SAVE ACTIVE TIMER STATE
  // -----------------------------

  const persistActiveSession = useCallback(
    async (status, remainingSeconds, endAt) => {
      if (!sessionIdRef.current) {
        sessionIdRef.current = createSessionId();
      }

      if (!startedAtRef.current) {
        startedAtRef.current = new Date().toISOString();
      }

      try {
        await saveActiveFocusSession({
          sessionId: sessionIdRef.current,
          taskName,
          plannedMinutes: sessionMinutes,
          remainingSeconds,
          status,
          startedAt: startedAtRef.current,
          endAt: endAt
            ? new Date(endAt).toISOString()
            : null,
        });

        if (mountedRef.current) {
          setErrorMessage("");
        }

        return true;
      } catch (error) {
        console.error(
          "Could not save active timer:",
          error
        );

        if (mountedRef.current) {
          setErrorMessage(
            "Your timer is working, but its latest state could not be synced to the cloud."
          );
        }

        return false;
      }
    },
    [taskName, sessionMinutes]
  );

  // -----------------------------
  // COMPLETE AND SAVE SESSION
  // -----------------------------

  const completeAndSaveSession = useCallback(
    async (session) => {
      if (!session) {
        throw new Error(
          "No completed session is available to save."
        );
      }

      setIsSaving(true);
      setSaveFailed(false);

      try {
        await saveFocusSession({
          id: session.sessionId,
          sessionId: session.sessionId,
          taskName: session.taskName,
          plannedMinutes: session.plannedMinutes,
          actualFocusedSeconds: session.actualFocusedSeconds,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
        });

        // The completed session has been saved.
        savedSessionRef.current = true;
        pendingSessionRef.current = null;

        if (mountedRef.current) {
          setSaveFailed(false);
          setErrorMessage("");
        }

        try {
          await clearActiveFocusSession();
        } catch (cleanupError) {
          console.error(
            "Session saved, but active timer cleanup failed:",
            cleanupError
          );

          if (mountedRef.current) {
            setErrorMessage(
              "Your session was saved successfully, but the previous active timer could not be cleared."
            );
          }
        }

        try {
          await refreshHistory();
        } catch (historyError) {
          console.error(
            "Session saved, but history refresh failed:",
            historyError
          );

          if (mountedRef.current) {
            setErrorMessage(
              "Your session was saved successfully. The history list could not refresh; try opening it again."
            );
          }
        }

        if (mountedRef.current) {
          onTimerEnd?.();
        }

        return true;
      } catch (error) {
        console.error(
          "Could not save completed focus session:",
          error
        );

        if (mountedRef.current) {
          setSaveFailed(true);
          setErrorMessage(
            "Your session finished, but its cloud save failed. Keep this screen open and tap Retry saving."
          );
        }

        return false;
      } finally {
        if (mountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [refreshHistory, onTimerEnd]
  );

  // -----------------------------
  // DETECT TIMER COMPLETION
  // -----------------------------

  useEffect(() => {
    if (
      !isStarted ||
      secondsLeft !== 0 ||
      savedSessionRef.current
    ) {
      return;
    }

    // Prevent this session from completing more than once.
    savedSessionRef.current = true;

    setIsStarted(false);
    setIsComplete(true);
    setIsSaving(true);

    endAtRef.current = null;

    const completedAt = new Date().toISOString();

    const completedSession = {
      sessionId:
        sessionIdRef.current || createSessionId(),
      taskName,
      plannedMinutes: sessionMinutes,
      actualFocusedSeconds: sessionMinutes * 60,
      startedAt:
        startedAtRef.current || completedAt,
      completedAt,
    };

    sessionIdRef.current = completedSession.sessionId;
    pendingSessionRef.current = completedSession;

    const finishSession = async () => {
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch (error) {
        console.warn("Haptics unavailable:", error);
      }

      try {
        await completionSound.seekTo(0);
        completionSound.play();
      } catch (error) {
        console.warn(
          "Completion sound unavailable:",
          error
        );
      }

      await completeAndSaveSession(completedSession);
    };

    finishSession();
  }, [
    isStarted,
    secondsLeft,
    taskName,
    sessionMinutes,
    completionSound,
    completeAndSaveSession,
  ]);

  // -----------------------------
  // RETRY A FAILED SESSION SAVE
  // -----------------------------

  const retrySaveCompletedSession = async () => {
    if (isSaving) return;

    const pendingSession = pendingSessionRef.current;

    if (!pendingSession) {
      setErrorMessage(
        "There is no pending session to retry. Check your focus history."
      );
      return;
    }

    await completeAndSaveSession(pendingSession);
  };

  // -----------------------------
  // START / PAUSE / RESUME
  // -----------------------------

  const handleStartPause = async () => {
    if (isComplete || isSaving || isLoading) return;

    if (isStarted) {
      const remaining = endAtRef.current
        ? Math.max(
            0,
            Math.ceil(
              (endAtRef.current - Date.now()) / 1000
            )
          )
        : secondsLeft;

      endAtRef.current = null;

      setSecondsLeft(remaining);
      setIsStarted(false);

      await persistActiveSession(
        "paused",
        remaining,
        null
      );

      return;
    }

    if (secondsLeft <= 0) {
      setSecondsLeft(sessionMinutes * 60);
    }

    if (!startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
    }

    if (!sessionIdRef.current) {
      sessionIdRef.current = createSessionId();
    }

    savedSessionRef.current = false;
    pendingSessionRef.current = null;

    const startingSeconds =
      secondsLeft > 0
        ? secondsLeft
        : sessionMinutes * 60;

    const endAt =
      Date.now() + startingSeconds * 1000;

    endAtRef.current = endAt;

    setSecondsLeft(startingSeconds);
    setErrorMessage("");
    setIsStarted(true);

    await persistActiveSession(
      "running",
      startingSeconds,
      endAt
    );
  };

  // -----------------------------
  // RESET TIMER
  // -----------------------------

  const resetTimer = async () => {
    setIsStarted(false);
    setIsComplete(false);
    setSecondsLeft(sessionMinutes * 60);

    endAtRef.current = null;
    startedAtRef.current = null;
    sessionIdRef.current = null;
    savedSessionRef.current = false;
    pendingSessionRef.current = null;

    setSaveFailed(false);
    setErrorMessage("");

    try {
      await clearActiveFocusSession();
    } catch (error) {
      console.error(
        "Could not clear active timer:",
        error
      );

      if (mountedRef.current) {
        setErrorMessage(
          "The timer was reset, but its previous cloud state could not be cleared."
        );
      }
    }
  };

  // -----------------------------
  // CHANGE DURATION
  // -----------------------------

  const chooseDuration = async (minutes) => {
    if (
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 180
    ) {
      Alert.alert(
        "Invalid duration",
        "Choose a whole number between 1 and 180 minutes."
      );
      return;
    }

    if (isStarted || (progress > 0 && !isComplete)) {
      Alert.alert(
        "Reset the timer first",
        "Reset your current session before changing its duration."
      );
      return;
    }

    setSessionMinutes(minutes);
    setSecondsLeft(minutes * 60);
    setCustomMinutes("");
    setIsComplete(false);

    startedAtRef.current = null;
    sessionIdRef.current = null;
    savedSessionRef.current = false;
    pendingSessionRef.current = null;
    endAtRef.current = null;

    setSaveFailed(false);
    setErrorMessage("");

    try {
      await saveFocusPreferences(minutes);

      try {
        await clearActiveFocusSession();
      } catch (cleanupError) {
        console.error(
          "Duration saved, but active timer cleanup failed:",
          cleanupError
        );

        if (mountedRef.current) {
          setErrorMessage(
            "Your new duration was saved, but the old active timer could not be cleared."
          );
        }
      }
    } catch (error) {
      console.error(
        "Could not save duration preference:",
        error
      );

      if (mountedRef.current) {
        setErrorMessage(
          "Your duration changed on this screen, but the cloud preference could not be saved."
        );
      }
    }
  };

  const handleNewTask = async () => {
    await resetTimer();
    setRestoredTaskName("");
    clearSubject?.();
  };

  // -----------------------------
  // HISTORY STATISTICS
  // -----------------------------

  const completedCount = history.filter(
    (item) => item.status === "completed"
  ).length;

  const totalFocusedSeconds = history.reduce(
    (total, item) =>
      total +
      (Number(item.actualFocusedSeconds) || 0),
    0
  );

  const totalFocusedMinutes = Math.floor(
    totalFocusedSeconds / 60
  );

  // -----------------------------
  // LOADING SCREEN
  // -----------------------------

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={colors.accent}
        />
        <Text style={styles.loadingText}>
          Preparing your focus space...
        </Text>
      </View>
    );
  }

  // -----------------------------
  // TIMER INTERFACE
  // -----------------------------

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>FOCUSTIME</Text>
          <Text style={styles.greeting}>
            Make this moment count.
          </Text>
        </View>

        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {sessionMinutes} MIN
          </Text>
        </View>
      </View>

      {!!errorMessage && (
        <View style={styles.errorBox}>
          <Ionicons
            name="cloud-offline-outline"
            size={19}
            color="#FFD0CA"
          />

          <Text style={styles.errorText}>
            {errorMessage}
          </Text>

          {saveFailed && (
            <Pressable
              onPress={retrySaveCompletedSession}
              disabled={isSaving}
              style={styles.retryButton}
            >
              {isSaving ? (
                <ActivityIndicator
                  size="small"
                  color={colors.navy}
                />
              ) : (
                <Text style={styles.retryButtonText}>
                  Retry saving
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            isStarted && styles.activeDot,
            isComplete && styles.completeDot,
          ]}
        />

        <Text style={styles.statusText}>
          {isSaving
            ? "SAVING YOUR SESSION"
            : isComplete
              ? saveFailed
                ? "SESSION NEEDS SAVING"
                : "SESSION COMPLETED"
              : isStarted
                ? "YOU'RE IN THE ZONE"
                : progress > 0
                  ? "SESSION PAUSED"
                  : "READY WHEN YOU ARE"}
        </Text>
      </View>

      <View style={styles.timerCard}>
        <Text style={styles.timerHeading}>
          {isComplete
            ? "Beautiful work."
            : isStarted
              ? "Stay focused."
              : progress > 0
                ? "Take your time."
                : "Time to focus"}
        </Text>

        <Text style={styles.timerDescription}>
          {isComplete
            ? saveFailed
              ? "Your session is finished. Let's make sure it reaches the cloud."
              : "You showed up for yourself. That's what counts."
            : isStarted
              ? "One task. One moment. Keep going."
              : progress > 0
                ? "Your session is paused. Resume whenever you're ready."
                : "Take a breath. Let everything else wait."}
        </Text>

        <View style={styles.clockFace}>
          <View style={styles.clockInner}>
            <Text style={styles.clockTime}>
              {formatTime(secondsLeft)}
            </Text>

            <Text style={styles.clockCaption}>
              {isComplete
                ? "WELL DONE"
                : "TIME REMAINING"}
            </Text>
          </View>
        </View>

        <View style={styles.progressLabels}>
          <Text style={styles.progressTitle}>
            SESSION PROGRESS
          </Text>

          <Text style={styles.progressValue}>
            {Math.round(progress * 100)}%
          </Text>
        </View>

        <ProgressBar
          progress={progress}
          color={colors.accent}
          style={styles.progressBar}
        />

        <View style={styles.progressFooter}>
          <Text style={styles.progressFooterText}>
            {sessionMinutes} min session
          </Text>

          <Text style={styles.progressFooterText}>
            {Math.floor(
              (totalSeconds - secondsLeft) / 60
            )}{" "}
            min elapsed
          </Text>
        </View>
      </View>

      <View style={styles.durationCard}>
        <Text style={styles.sectionTitle}>
          Choose your duration
        </Text>

        <Text style={styles.sectionSubtitle}>
          Select a session length that works for you.
        </Text>

        <View style={styles.durationOptions}>
          {DURATION_OPTIONS.map((minutes) => {
            const selected =
              sessionMinutes === minutes;

            const disabled =
              isStarted ||
              (progress > 0 && !isComplete);

            return (
              <Pressable
                key={minutes}
                disabled={disabled}
                onPress={() => chooseDuration(minutes)}
                style={[
                  styles.durationOption,
                  selected && styles.durationSelected,
                  disabled && styles.disabledButton,
                ]}
              >
                <Text
                  style={[
                    styles.durationOptionText,
                    selected &&
                      styles.durationSelectedText,
                  ]}
                >
                  {minutes}m
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.customDurationRow}>
          <TextInput
            value={customMinutes}
            onChangeText={setCustomMinutes}
            keyboardType="number-pad"
            placeholder="Custom minutes (1–180)"
            placeholderTextColor="#8290A5"
            style={styles.customInput}
            editable={
              !isStarted &&
              !(progress > 0 && !isComplete)
            }
            maxLength={3}
          />

          <Pressable
            onPress={() => {
              const value = customMinutes.trim();

              if (!/^\d+$/.test(value)) {
                Alert.alert(
                  "Invalid duration",
                  "Enter a whole number from 1 to 180."
                );
                return;
              }

              chooseDuration(Number(value));
            }}
            disabled={
              isStarted ||
              (progress > 0 && !isComplete) ||
              !customMinutes.trim()
            }
            style={({ pressed }) => [
              styles.applyButton,
              pressed && styles.buttonPressed,
              (!customMinutes.trim() ||
                isStarted ||
                (progress > 0 && !isComplete)) &&
                styles.disabledButton,
            ]}
          >
            <Text style={styles.applyButtonText}>
              Apply
            </Text>
          </Pressable>
        </View>

        {(isStarted ||
          (progress > 0 && !isComplete)) && (
          <Text style={styles.durationHint}>
            Reset the timer before choosing another duration.
          </Text>
        )}
      </View>

      <View style={styles.taskCard}>
        <View style={styles.taskIcon}>
          <Ionicons
            name="flash-outline"
            size={25}
            color={colors.lightBlue}
          />
        </View>

        <View style={styles.taskDetails}>
          <Text style={styles.taskLabel}>
            YOUR CURRENT FOCUS
          </Text>

          <Text
            style={styles.taskTitle}
            numberOfLines={3}
          >
            {taskName}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.circularControls}>
          <View style={styles.controlItem}>
            <Pressable
              onPress={resetTimer}
              accessibilityRole="button"
              accessibilityLabel="Reset timer"
              style={({ pressed }) => [
                styles.circleButton,
                styles.secondaryCircle,
                pressed && styles.circlePressed,
              ]}
            >
              <Ionicons
                name="refresh-outline"
                size={25}
                color={colors.white}
              />
            </Pressable>

            <Text style={styles.controlLabel}>
              Reset
            </Text>
          </View>

          <View style={styles.controlItem}>
            <Pressable
              onPress={
                isComplete
                  ? resetTimer
                  : handleStartPause
              }
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={
                isComplete
                  ? "Start again"
                  : isStarted
                    ? "Pause session"
                    : progress > 0
                      ? "Resume session"
                      : "Start focusing"
              }
              style={({ pressed }) => [
                styles.circleButton,
                styles.mainCircle,
                pressed && styles.circlePressed,
                isSaving && styles.disabledButton,
              ]}
            >
              <Ionicons
                name={
                  isComplete
                    ? "refresh"
                    : isStarted
                      ? "pause"
                      : "play"
                }
                size={32}
                color={colors.navy}
              />
            </Pressable>

            <Text style={styles.controlLabel}>
              {isComplete
                ? "Again"
                : isStarted
                  ? "Pause"
                  : progress > 0
                    ? "Resume"
                    : "Start"}
            </Text>
          </View>

          <View style={styles.controlItem}>
            <Pressable
              onPress={handleNewTask}
              accessibilityRole="button"
              accessibilityLabel="Choose another task"
              style={({ pressed }) => [
                styles.circleButton,
                styles.secondaryCircle,
                pressed && styles.circlePressed,
              ]}
            >
              <Ionicons
                name="list-outline"
                size={25}
                color={colors.white}
              />
            </Pressable>

            <Text style={styles.controlLabel}>
              New task
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => {
          const nextValue = !showHistory;
          setShowHistory(nextValue);

          if (nextValue) {
            handleRefreshHistory();
          }
        }}
        style={styles.historyToggle}
      >
        <View style={styles.historyToggleLeft}>
          <Ionicons
            name="time-outline"
            size={22}
            color={colors.accent}
          />

          <Text style={styles.historyToggleText}>
            Focus history ({history.length})
          </Text>
        </View>

        <Ionicons
          name={
            showHistory
              ? "chevron-up"
              : "chevron-down"
          }
          size={22}
          color={colors.white}
        />
      </Pressable>

      {showHistory && (
        <View style={styles.historyCard}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {completedCount}
              </Text>

              <Text style={styles.statLabel}>
                Sessions
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {totalFocusedMinutes}
              </Text>

              <Text style={styles.statLabel}>
                Minutes focused
              </Text>
            </View>
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons
                name="hourglass-outline"
                size={35}
                color="#8290A5"
              />

              <Text style={styles.emptyHistoryTitle}>
                Your story starts here
              </Text>

              <Text style={styles.emptyHistoryText}>
                Completed focus sessions will appear here.
              </Text>
            </View>
          ) : (
            history.map((item) => (
              <View
                key={item.id}
                style={styles.historyItem}
              >
                <View style={styles.historyIcon}>
                  <Ionicons
                    name="checkmark-circle"
                    size={23}
                    color={colors.success}
                  />
                </View>

                <View style={styles.historyDetails}>
                  <Text style={styles.historyTask}>
                    {item.taskName ||
                      "Untitled focus task"}
                  </Text>

                  <Text style={styles.historyDate}>
                    {formatDate(item.completedAt)}
                  </Text>
                </View>

                <View style={styles.historyDuration}>
                  <Text style={styles.historyMinutes}>
                    {Math.floor(
                      (Number(
                        item.actualFocusedSeconds
                      ) || 0) / 60
                    )}m
                  </Text>

                  <Text style={styles.historyStatus}>
                    Completed
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <View style={styles.motivation}>
        <Text style={styles.motivationMark}>“</Text>

        <Text style={styles.motivationText}>
          You don't have to do everything. Just the next thing.
        </Text>
      </View>

      <Text style={styles.footer}>
        ONE THING AT A TIME.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: "100%",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 35,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: colors.darkBlue,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    color: colors.white,
    marginTop: 14,
    fontSize: 13,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  brand: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2.5,
  },

  greeting: {
    color: "#A9B9D2",
    fontSize: 12,
    marginTop: 6,
  },

  headerBadge: {
    backgroundColor: "#263957",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#3C5071",
  },

  headerBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
  },

  errorBox: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#63312F",
    marginBottom: 16,
  },

  errorText: {
    color: "#FFE0DB",
    fontSize: 12,
    lineHeight: 18,
  },

  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 115,
    alignItems: "center",
  },

  retryButtonText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: "900",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#92A0B6",
  },

  activeDot: {
    backgroundColor: colors.accent,
  },

  completeDot: {
    backgroundColor: colors.success,
  },

  statusText: {
    color: "#B8C6DB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
  },

  timerCard: {
    backgroundColor: colors.navy,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 25,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: "#304363",
  },

  timerHeading: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },

  timerDescription: {
    color: "#AAB9D0",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },

  clockFace: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 8,
    borderColor: "#304363",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
    backgroundColor: "#172642",
  },

  clockInner: {
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 3,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  clockTime: {
    color: colors.white,
    fontSize: 43,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },

  clockCaption: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 8,
  },

  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  progressTitle: {
    color: "#AAB9D0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  progressValue: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
  },

  progressBar: {
    height: 7,
    borderRadius: 8,
    backgroundColor: "#3B4D6A",
    overflow: "hidden",
  },

  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  progressFooterText: {
    color: "#94A6C1",
    fontSize: 10,
  },

  durationCard: {
    backgroundColor: "#1B2C49",
    borderWidth: 1,
    borderColor: "#304363",
    borderRadius: 22,
    padding: 17,
    marginTop: 20,
  },

  sectionTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },

  sectionSubtitle: {
    color: "#AAB9D0",
    fontSize: 11,
    marginTop: 6,
    marginBottom: 15,
  },

  durationOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  durationOption: {
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 13,
    backgroundColor: "#263957",
    borderWidth: 1,
    borderColor: "#425675",
    alignItems: "center",
  },

  durationSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  durationOptionText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 12,
  },

  durationSelectedText: {
    color: colors.navy,
  },

  customDurationRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
  },

  customInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#101B33",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#425675",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 12,
  },

  applyButton: {
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  applyButtonText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.5,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  durationHint: {
    color: "#B8C6DB",
    fontSize: 10,
    marginTop: 12,
  },

  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 17,
    borderRadius: 22,
    backgroundColor: colors.white,
    marginTop: 20,
  },

  taskIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: "#EAF0FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  taskDetails: {
    flex: 1,
  },

  taskLabel: {
    color: colors.mutedText,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 7,
  },

  taskTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },

  controls: {
    marginTop: 28,
    marginBottom: 8,
  },

  circularControls: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 28,
  },

  controlItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 66,
  },

  circleButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  secondaryCircle: {
    backgroundColor: "#263957",
    borderColor: "#425675",
  },

  mainCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    marginTop: -8,
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    elevation: 5,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },

  circlePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },

  controlLabel: {
    marginTop: 10,
    color: "#B8C6DB",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 17,
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: "#263957",
    borderWidth: 1,
    borderColor: "#425675",
  },

  historyToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  historyToggleText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  historyCard: {
    backgroundColor: "#1B2C49",
    padding: 15,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#304363",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#263957",
  },

  statNumber: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: "900",
  },

  statLabel: {
    color: "#B8C6DB",
    fontSize: 10,
    marginTop: 5,
  },

  emptyHistory: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 15,
  },

  emptyHistoryTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  emptyHistoryText: {
    color: "#AAB9D0",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },

  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#344664",
  },

  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#203E4A",
    alignItems: "center",
    justifyContent: "center",
  },

  historyDetails: {
    flex: 1,
  },

  historyTask: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },

  historyDate: {
    color: "#AAB9D0",
    fontSize: 10,
    marginTop: 5,
  },

  historyDuration: {
    alignItems: "flex-end",
  },

  historyMinutes: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "900",
  },

  historyStatus: {
    color: "#AAB9D0",
    fontSize: 9,
    marginTop: 4,
  },

  motivation: {
    alignItems: "center",
    marginTop: 26,
    paddingHorizontal: 10,
  },

  motivationMark: {
    color: colors.accent,
    fontSize: 35,
    height: 28,
    fontWeight: "800",
  },

  motivationText: {
    color: "#B6C4D9",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 20,
    fontStyle: "italic",
  },

  footer: {
    color: "#7185A3",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 25,
  },
});


import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

import { colors } from "../utils/colors";

const formatTime = (time) => String(time).padStart(2, "0");

export const Countdown = ({
  minutes = 0.5,
  isPaused,
  onProgress,
  onEnd,
}) => {
  const duration = Math.max(1000, minutes * 60 * 1000);

  const [millis, setMillis] = useState(duration);

  const endCalled = useRef(false);
  const onEndRef = useRef(onEnd);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    setMillis(duration);
    endCalled.current = false;
  }, [duration]);

  useEffect(() => {
    const remainingFraction = Math.max(
      0,
      Math.min(1, millis / duration)
    );

    onProgressRef.current?.(remainingFraction);
  }, [millis, duration]);

  useEffect(() => {
    if (isPaused || millis <= 0) {
      return undefined;
    }

    const interval = setInterval(() => {
      setMillis((current) =>
        Math.max(0, current - 1000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, millis]);

  useEffect(() => {
    if (millis === 0 && !endCalled.current) {
      endCalled.current = true;
      onEndRef.current?.();
    }
  }, [millis]);

  const totalSeconds = Math.ceil(millis / 1000);
  const minute = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <View style={styles.container}>
      <View style={styles.outerRing}>
        <View style={styles.innerRing}>
          <Text style={styles.time}>
            {formatTime(minute)}:{formatTime(seconds)}
          </Text>

          <Text style={styles.caption}>
            {millis === 0
              ? "SESSION COMPLETE"
              : "MINUTES TO YOURSELF"}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },

  outerRing: {
    width: 248,
    height: 248,
    borderRadius: 124,
    borderWidth: 2,
    borderColor: "#3B5276",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(91, 140, 255, 0.07)",
  },

  innerRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#1C2C49",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#304363",
  },

  time: {
    color: colors.white,
    fontSize: 46,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },

  caption: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 12,
    textAlign: "center",
  },
});


import React, { useState } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { Timer } from "../features/Timer";
import { Focus } from "../features/Focus";
import { colors } from "../utils/colors";

export default function Index() {
  const [currentSubject, setCurrentSubject] = useState("");

  const clearSubject = () => {
    setCurrentSubject("");
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right", "bottom"]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.darkBlue}
      />

      <LinearGradient
        colors={["#1B3153", colors.darkBlue]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={
            Platform.OS === "ios" ? "padding" : undefined
          }
        >
          <View style={styles.appContainer}>
            {currentSubject.trim() === "" ? (
              <Focus addSubject={setCurrentSubject} />
            ) : (
              <Timer
                key={currentSubject}
                focusSubject={currentSubject}
                clearSubject={clearSubject}
                onTimerEnd={() => {
                  // Completion is handled inside Timer.js.
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.darkBlue,
  },

  gradient: {
    flex: 1,
  },

  keyboardView: {
    flex: 1,
  },

  appContainer: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
    maxWidth: 560,
  },
});

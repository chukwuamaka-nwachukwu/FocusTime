
// features/Focus.js

import React, { useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
  Image,
} from "react-native";

import { TextInput } from "react-native-paper";

import logo from "../../assets/icons/app-icon.png";

import { colors } from "../utils/colors";

import { RoundedButton } from "../components/RoundedButton";

export const Focus = ({ addSubject }) => {
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");

  const handleAddSubject = () => {
    const trimmedSubject = subject.trim();

    if (!trimmedSubject) {
      setError("Please enter a task to get started.");
      return;
    }

    Keyboard.dismiss();

    addSubject(trimmedSubject);

    setSubject("");
    setError("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo and branding */}
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <Image
              source={logo}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="FocusTime app logo"
            />
          </View>

          <Text style={styles.brand}>FOCUSTIME</Text>

          <Text style={styles.eyebrow}>
            YOUR PERSONAL FOCUS SPACE
          </Text>
        </View>

        {/* Welcome message */}
        <View style={styles.hero}>
          <Text style={styles.heading}>
            Make room for{"\n"}
            <Text style={styles.headingAccent}>
              what matters.
            </Text>
          </Text>

          <Text style={styles.description}>
            One task. One session. Your full attention.
            {"\n"}
            Let's make today count.
          </Text>
        </View>

        {/* Task input card */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            What are we focusing on?
          </Text>

          <Text style={styles.formSubtitle}>
            Choose one thing you'd like to accomplish.
          </Text>

          <TextInput
            mode="outlined"
            label="Enter your task"
            placeholder="e.g. Learn React Native"
            value={subject}
            onChangeText={(value) => {
              setSubject(value);

              if (error) {
                setError("");
              }
            }}
            onSubmitEditing={handleAddSubject}
            returnKeyType="go"
            maxLength={100}
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.lightBlue}
            textColor={colors.text}
            theme={{
              roundness: 14,
              colors: {
                background: colors.white,
                onSurfaceVariant: colors.mutedText,
                primary: colors.lightBlue,
              },
            }}
            left={
              <TextInput.Icon
                icon="target"
                color={colors.mutedText}
              />
            }
          />

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <RoundedButton
            title="Start focusing  →"
            onPress={handleAddSubject}
            style={styles.startButton}
          />

          {/* Session reminder */}
          <View style={styles.sessionNote}>
            <Text style={styles.noteIcon}>◷</Text>

            <Text style={styles.noteText}>
              A 25-minute session is a great place to start.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.bottomSection}>
          <View style={styles.dot} />

          <Text style={styles.footer}>
            Progress over perfection.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    marginTop: 40,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    justifyContent: "space-between",
  },

  topSection: {
    alignItems: "center",
    paddingTop: 6,
  },

  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    marginTop: 10,
  },

  logo: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },

  brand: {
    fontSize: 17,
    letterSpacing: 3,
    fontWeight: "800",
    color: colors.white,
  },

  eyebrow: {
    color: "#A6B7D2",
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 6,
    fontWeight: "700",
  },

  hero: {
    marginTop: 40,
    marginBottom: 26,
  },

  heading: {
    color: colors.white,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -1.2,
    textAlign: "center",
  },

  headingAccent: {
    color: colors.accent,
    textAlign: "center",
  },

  description: {
    color: "#B4C2D9",
    fontSize: 14,
    lineHeight: 23,
    marginTop: 14,
    textAlign: "center",
  },

  formCard: {
    backgroundColor: colors.white,
    borderRadius: 26,
    padding: 22,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },

  formTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },

  formSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 20,
    textAlign: "center",
  },

  input: {
    backgroundColor: colors.white,
    fontSize: 14,
  },

  error: {
    color: "#D9485F",
    fontSize: 12,
    marginTop: 8,
  },

  startButton: {
    width: "100%",
    marginTop: 18,
    minHeight: 56,
    borderRadius: 16,
  },

  sessionNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    gap: 8,
  },

  noteIcon: {
    fontSize: 19,
    color: colors.lightBlue,
  },

  noteText: {
    color: colors.mutedText,
    fontSize: 11,
    flexShrink: 1,
  },

  bottomSection: {
    alignItems: "center",
    marginTop: 28,
  },

  dot: {
    width: 24,
    height: 4,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginBottom: 10,
  },

  footer: {
    color: "#9EADC5",
    fontSize: 12,
  },
});

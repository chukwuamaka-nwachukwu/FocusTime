
import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

import { colors } from "../utils/colors";

export const RoundedButton = ({
  title,
  onPress,
  size,
  style,
  textStyle,
  disabled = false,
  loading = false,
  variant = "primary",
}) => {
  const isCircular = typeof size === "number";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isCircular && {
          width: size,
          height: size,
          borderRadius: size / 2,
          paddingHorizontal: 0,
          minHeight: size,
        },
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "outline" && styles.outline,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text
          style={[
            styles.text,
            isCircular && { fontSize: size / 3 },
            variant === "secondary" && styles.secondaryText,
            variant === "outline" && styles.outlineText,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    paddingHorizontal: 24,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  primary: {
    backgroundColor: colors.lightBlue,
  },

  secondary: {
    backgroundColor: "#263653",
    borderWidth: 1,
    borderColor: "#3B4D6A",
  },

  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },

  disabled: {
    opacity: 0.55,
  },

  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },

  secondaryText: {
    color: "#DDE7F8",
  },

  outlineText: {
    color: colors.text,
  },
});

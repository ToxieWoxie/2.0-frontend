import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";

export type BackButtonProps = {
  label?: string;
  onPress?: () => void;
};

/**
 * Shared back button.
 *
 * Defaults to `router.back()` so screens stay simple.
 */
export function BackButton({ label = "Go back", onPress }: BackButtonProps) {
  return (
    <Pressable style={styles.button} onPress={onPress ?? (() => router.back())}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#23272A",
  },
  text: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

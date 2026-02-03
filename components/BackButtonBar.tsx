// FILE: components/BackButtonBar.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export type BackButtonBarProps = {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function BackButtonBar({ title = "", onBack, right }: BackButtonBarProps) {
  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backText}>←</Text>
      </Pressable>

      <Text style={styles.title} numberOfLines={1} accessibilityRole="text">
        {title}
      </Text>

      <View style={styles.right}>{right ?? null}</View>
    </View>
  );
}

export default BackButtonBar;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
    gap: 10,
  },
  backBtn: { width: 40, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 18, fontWeight: "900" },
  title: { flex: 1, fontSize: 16, fontWeight: "900" },
  right: { minWidth: 40, alignItems: "flex-end" },
  pressed: { opacity: 0.7 },
});

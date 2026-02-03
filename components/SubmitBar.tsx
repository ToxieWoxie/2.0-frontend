import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function SubmitBar({ onSubmit, disabled }: { onSubmit: () => void; disabled?: boolean }) {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onSubmit}
        disabled={!!disabled}
        style={({ pressed }) => [styles.btn, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      >
        <Text style={styles.btnText}>Submit to Library</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e8e8e8",
  },
  btn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#2b62ff",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#ffffff", fontWeight: "800" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});

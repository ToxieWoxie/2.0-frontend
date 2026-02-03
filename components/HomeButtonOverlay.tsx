// Syn/components/HomeButtonOverlay.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { router, usePathname } from "expo-router";

const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

export default function HomeButtonOverlay() {
  const pathname = usePathname();

  // ✅ Hide on index page
  if (pathname === "/") return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable
        onPress={() => router.replace("/")}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Go to home"
      >
        <Text style={styles.text}>Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: Platform.OS === "web" ? ("fixed" as const) : ("absolute" as const),
    left: "50%",
    bottom: 18,
    transform: [{ translateX: -50 }],
    zIndex: 999999,
    elevation: 999999,
    padding: 10,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontFamily: SERIF,
    fontSize: 18,
  },
  pressed: { opacity: 0.75 },
});

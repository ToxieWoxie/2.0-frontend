// app/settings.tsx
import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sub}>Blank for now.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f7f7" },
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: "900", color: "#111" },
  sub: { marginTop: 8, color: "#666", fontWeight: "600" },
});

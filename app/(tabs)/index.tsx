import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <View style={styles.header}>
          <Text style={styles.title}>Synesthete</Text>

          <View style={styles.topButtons}>
            <Pressable
              style={styles.buttonPrimary}
              onPress={() => router.push("/signup")}
            >
              <Text style={styles.buttonText}>Sign Up</Text>
            </Pressable>

            <Pressable
              style={styles.buttonDark}
              onPress={() => router.push("/login")}
            >
              <Text style={styles.buttonText}>Log In</Text>
            </Pressable>
          </View>
        </View>

        {Array.from({ length: 30 }).map((_, i) => (
          <Text key={i} style={styles.fillerText}>
            Scroll Content {i + 1}
          </Text>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.buttonCreate} onPress={() => router.push("/create")}>
          <Text style={styles.footerText}>Create</Text>
        </Pressable>

        <Pressable style={styles.buttonJoin} onPress={() => router.push("/join")}>
          <Text style={styles.footerText}>Join</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 60,
    fontWeight: "bold",
  },
  topButtons: {
    flexDirection: "row",
    gap: 12,
  },
  fillerText: {
    fontSize: 20,
    paddingVertical: 18,
    textAlign: "center",
    opacity: 0.9,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  footerText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 28,
  },
  buttonCreate: {
    backgroundColor: "#B0FCCC",
    paddingVertical: 20,
    paddingHorizontal: 60,
    borderRadius: 20,
  },
  buttonJoin: {
    backgroundColor: "#E0B0FF",
    paddingVertical: 20,
    paddingHorizontal: 60,
    borderRadius: 20,
  },
  buttonPrimary: {
    backgroundColor: "#f258f2ff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  buttonDark: {
    backgroundColor: "#23272A",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
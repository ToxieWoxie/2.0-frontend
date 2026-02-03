// FILE: Syn/components/LoginRequiredScreen.tsx
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

type Props = {
  title?: string;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
};

export default function LoginRequiredScreen(props: Props) {
  const {
    title = "Login required",
    message = "You need to log in to take this quiz.",
    primaryLabel = "Log In",
    secondaryLabel = "Go Back",
    onPrimary,
    onSecondary,
  } = props;

  return (
    <LinearGradient colors={["#061A40", "#0F766E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
        <View style={styles.header}>
          <Text style={styles.brand}>Synesthete</Text>

          <View style={styles.topButtons}>
            <Pressable
              style={({ pressed }) => [styles.buttonDark, pressed && styles.pressed]}
              onPress={onPrimary}
              accessibilityRole="button"
              accessibilityLabel="Log in"
            >
              <Text style={styles.buttonText}>{primaryLabel}</Text>
            </Pressable>

            {onSecondary ? (
              <Pressable
                style={({ pressed }) => [styles.buttonDark, pressed && styles.pressed]}
                onPress={onSecondary}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Text style={styles.buttonText}>{secondaryLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.landingContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionBody}>{message}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },

  scrollContent: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  header: {
    marginTop: -50,
    paddingTop: 50,
    backgroundColor: "rgba(38, 83, 108, 0.62)",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: 12,
  },

  brand: {
    fontSize: 64,
    fontWeight: "bold",
    color: "#fff",
    fontFamily: SERIF,
    flexShrink: 1,
    minWidth: 0,
  },

  topButtons: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  buttonDark: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    cursor: Platform.OS === "web" ? "pointer" : "auto",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: SERIF,
    fontSize: 16,
  },

  landingContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },

  section: { marginBottom: 48 },

  sectionTitle: {
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 22,
    textAlign: "center",
    color: "#fff",
    fontFamily: SERIF,
    marginTop: 90,
  },

  sectionBody: {
    fontSize: 16,
    lineHeight: 30,
    opacity: 0.92,
    color: "#fff",
    fontFamily: SERIF,
    textAlign: "center",
  },

  pressed: { opacity: 0.75 },
});
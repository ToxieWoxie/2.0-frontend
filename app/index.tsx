// FILE: Syn/app/index.tsx
// ===============================
import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
  StyleProp,
  TextStyle,
} from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "../components/AuthProvider";
import { LinearGradient } from "expo-linear-gradient";
import ConfirmLogoutModal from "../components/ConfirmLogoutModal";

type Section = { title: string; body: string };
type Props = {
  email: string;
  style?: StyleProp<TextStyle>;
  subject?: string;
  body?: string;
};

const SECTIONS: Section[] = [
  {
    title: "What is Synesthesia?",
    body:
      ' Synesthesia is a sensory phenomenon in which the stimulation of a single sense triggers involuntary sensory experiences in other, unrelated senses. These experiences are called Synesthetic experiences, and those who experience it are known as Synesthetes. Synesthetic experiences are marked as being consistent over time, automatic and involuntary, and are unlike learned behaviors as they don\'t appear to have a known cause. Synesthesia can occur in and across all five senses, but Synesthete has a particular focus on Grapheme Color Synesthesia, the most common type of Synesthesia. This includes the visual or mental perception of colors when viewing letters, numbers, or words.',
  },
  {
    title: "What is Synesthete",
    body:
      "Synesthete is a research tool and app aimed towards researchers and curious minds who seek to understand Grapheme Color Synesthesia. This app offers free research tools in the form of online sharable and collaborative quizzes, and includes built-in synesthesia diagnostic tools and statistics aimed to help simplify the research process.",
  },
  {
    title: "Our Goal",
    body:
      "Synesthete aims to bring attention to Synesthesia research and offer ways to simplify the difficult process of studying the trait. There are countless setbacks and unknowns to studying Synesthesia, with the diagnostic process being particularly difficult and tedious for many researchers. ",
  },
];

export default function HomeScreen() {
  const { user, loading, logoutUser } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const onConfirmLogout = async () => {
    setLogoutBusy(true);
    try {
      await logoutUser(); // cookie-based
      router.replace("/login");
    } finally {
      setLogoutBusy(false);
      setLogoutOpen(false);
    }
  };

  const onPressCreate = () => {
    if (user) {
      router.push("/library");
      return;
    }
    router.push("/library?loginRequired=1");
  };

  return (
    <LinearGradient
      colors={["#061A40", "#0F766E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
        <View style={styles.header}>
          <Text style={styles.title}>
            Synesthete{" "}
            <Text style={styles.emailText} onPress={() => Linking.openURL("mailto:thetesynes@gmail.com")}>
              thetesynes@gmail.com
            </Text>
          </Text>

          <View style={styles.topButtons}>
            {user ? (
              <>
                <Link href="/profile" asChild>
                  <Pressable style={styles.profileGreeting} disabled={loading}>
                    <Text style={styles.profileText}>{user.username}</Text>
                  </Pressable>
                </Link>

                <Pressable
                  style={({ pressed }) => [styles.profileGreeting, pressed && styles.pressed, loading && styles.disabledBtn]}
                  disabled={loading}
                  onPress={() => setLogoutOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Log out"
                >
                  <Text style={styles.profileText}>Log out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Link href="/signup" asChild>
                  <Pressable style={styles.buttonPrimary}>
                    <Text style={styles.buttonText}>Sign Up</Text>
                  </Pressable>
                </Link>

                <Link href="/login" asChild>
                  <Pressable style={styles.buttonDark}>
                    <Text style={styles.buttonText}>Log In</Text>
                  </Pressable>
                </Link>
              </>
            )}
          </View>
        </View>

        <View style={styles.landingContainer}>
          {SECTIONS.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Text style={styles.sectionBody}>{s.body}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.buttonCreate} onPress={onPressCreate} accessibilityRole="button" accessibilityLabel="Create">
          <Text style={styles.footerText}>Create</Text>
        </Pressable>

        <Link href="/join" asChild>
          <Pressable style={styles.buttonJoin}>
            <Text style={styles.footerText}>Join</Text>
          </Pressable>
        </Link>
      </View>

      <ConfirmLogoutModal
        visible={logoutOpen}
        busy={logoutBusy}
        onCancel={() => (logoutBusy ? null : setLogoutOpen(false))}
        onConfirm={onConfirmLogout}
      />
    </LinearGradient>
  );
}

const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

const styles = StyleSheet.create({
  profileGreeting: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  emailText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.85)",
    fontFamily: SERIF,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.85)",
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
    marginBottom: 46,
    textAlign: "center",
    color: "#fff",
    fontFamily: SERIF,
    marginTop: 90,
  },

  disabledBtn: { opacity: 0.6 },

  sectionBody: {
    fontSize: 16,
    lineHeight: 30,
    opacity: 0.92,
    color: "#fff",
    fontFamily: SERIF,
  },

  profileText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    fontFamily: SERIF,
  },

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

    // ✅ Web fix: allow wrapping so the 2nd button doesn't get pushed off-screen
    flexWrap: "wrap",
    rowGap: 12,
  },

  title: {
    fontSize: 80,
    fontWeight: "bold",
    color: "#fff",
    fontFamily: SERIF,

    // ✅ Web fix: allow title to shrink instead of pushing buttons off-screen
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

  pressed: { opacity: 0.75 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },

  footerText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 28,
    fontFamily: SERIF,
  },

  buttonCreate: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 20,
    paddingHorizontal: 60,
    borderRadius: 20,
  },

  buttonJoin: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 20,
    paddingHorizontal: 60,
    borderRadius: 20,
  },

  buttonPrimary: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    cursor: Platform.OS === "web" ? "pointer" : "auto",
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
  },
});

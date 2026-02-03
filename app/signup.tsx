// app/signup.tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AuthError, type SignUpInput } from "../lib/auth.types";
import { signUp } from "../lib/auth";

function safeRedirect(v: unknown): Href {
  if (typeof v === "string" && v.startsWith("/")) return v as Href;
  return "/profile";
}

// reuse your constant (matches home)
const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

export default function SignupScreen() {
  const params = useLocalSearchParams<{ redirect?: string }>();
  const redirect = safeRedirect(params.redirect);

  const [form, setForm] = useState<SignUpInput>({
    username: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  
const canSubmit = useMemo(() => {
  const value =
    !busy &&
    form.username.trim().length >= 2 &&
    form.email.trim().length > 0 &&
    form.password.length >= 6;

  console.log("signup form", form, { busy, canSubmit: value });
  return value;
}, [form, busy]);

  const handleSignup = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setInlineError(null);

    try {
      await signUp(form);
      Alert.alert("Success", "Account created!");
      router.replace(redirect);
    } catch (e: any) {
      const err = e instanceof AuthError ? e : null;
      setInlineError(err?.message ?? String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={["#061A40", "#0F766E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {/* Header matches homepage */}
             <View style={styles.header}>
                                      <Text style={styles.title}>
                                        Synesthete{" "}
                                        <Text
                                         style={styles.emailText}
                                          onPress={() => Linking.openURL("mailto:thetesynes@gmail.com")}
                                        >
                                          thetesynes@gmail.com
                                        </Text>
                                      </Text>
                        

              <View style={styles.topButtons}>
                <Pressable
                  style={styles.buttonDark}
                  onPress={() => router.push("/login")}
                >
                  <Text style={styles.buttonText}>Log In</Text>
                </Pressable>
              </View>
            </View>

            {/* Form card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Create account</Text>

              <TextInput
                value={form.username}
                onChangeText={(v) => setForm((s) => ({ ...s, username: v }))}
                placeholder="Username"
                placeholderTextColor="rgba(255,255,255,0.7)"
                style={styles.input}
              />

              <TextInput
                value={form.email}
                onChangeText={(v) => setForm((s) => ({ ...s, email: v }))}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.7)"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                value={form.password}
                onChangeText={(v) => setForm((s) => ({ ...s, password: v }))}
                placeholder="Password (min 6 chars)"
                placeholderTextColor="rgba(255,255,255,0.7)"
                secureTextEntry
                style={styles.input}
              />

              {inlineError && <Text style={styles.error}>{inlineError}</Text>}

              <Pressable
                onPress={handleSignup}
                disabled={!canSubmit}
                style={[styles.buttonPrimary, !canSubmit && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>
                  {busy ? "Creating..." : "Sign Up"}
                </Text>
              </Pressable>

              <Pressable onPress={() => router.push("/login")} style={styles.linkRow}>
                <Text style={styles.linkText}>Already have an account? Log In</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },

  scrollContent: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  },

  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#fff",
    fontFamily: SERIF,
  },

  emailText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    fontFamily: SERIF,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.85)",
  },

  topButtons: {
    flexDirection: "row",
    gap: 12,
  },

  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  cardTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    fontFamily: SERIF,
    marginBottom: 16,
    textAlign: "center",
  },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    color: "#fff",
    fontFamily: SERIF,
    fontSize: 16,
  },

  error: {
    color: "#ffd1d1",
    marginBottom: 12,
    fontFamily: SERIF,
  },

  buttonPrimary: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    marginTop: 6,
  },

  buttonDark: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: SERIF,
    fontSize: 16,
  },

  linkRow: {
    marginTop: 14,
    alignItems: "center",
  },

  linkText: {
    color: "rgba(255,255,255,0.9)",
    fontFamily: SERIF,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.9)",
  },
});

// app/login.tsx
import React, { useMemo } from "react";
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
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../components/AuthProvider";

const loginSchema = z.object({
  userName: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  email: z.string().trim().email("Invalid email").min(1, "Email is required"),
});

type LoginFormsInput = z.infer<typeof loginSchema>;

// reuse your constant (matches home/signup)
const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

export default function LoginPage() {
  const { loginUser } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<LoginFormsInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { userName: "", password: "", email: "" },
    mode: "onSubmit",
  });

  const values = watch();
  const canSubmit = useMemo(() => {
    return (
      !isSubmitting &&
      values.userName.trim().length > 0 &&
      values.email.trim().length > 0 &&
      values.password.length > 0
    );
  }, [values.email, values.password, isSubmitting]);

const onSubmit = async (form: LoginFormsInput) => {
  try {
    await loginUser("", form.password, form.email);
    router.replace("/profile");
  } catch (e: any) {
    Alert.alert("Login failed", e?.message ?? "Unknown error");
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
                  onPress={() => router.push("/signup")}
                >
                  <Text style={styles.buttonText}>Sign Up</Text>
                </Pressable>
              </View>
            </View>

            {/* Form card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign in to your account</Text>

              <Text style={styles.label}>Username</Text>
              <Controller
                control={control}
                name="userName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Username"
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    style={styles.input}
                    autoCapitalize="none"
                  />
                )}
              />
              {errors.userName?.message ? (
                <Text style={styles.error}>{errors.userName.message}</Text>
              ) : null}

              <Text style={styles.label}>Email</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                )}
              />
              {errors.email?.message ? (
                <Text style={styles.error}>{errors.email.message}</Text>
              ) : null}

              <Text style={styles.label}>Password</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    secureTextEntry
                    style={styles.input}
                  />
                )}
              />
              {errors.password?.message ? (
                <Text style={styles.error}>{errors.password.message}</Text>
              ) : null}

              <Pressable
                onPress={handleSubmit(onSubmit)}
                disabled={!canSubmit}
                style={[styles.buttonPrimary, !canSubmit && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Text>
              </Pressable>

              <Pressable onPress={() => router.push("/signup")} style={styles.linkRow}>
                <Text style={styles.linkText}>
                  Don’t have an account yet? Sign up
                </Text>
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
    // matches your home header bar look
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
  fontSize: 48,      // ✅ match signup
  fontWeight: "bold",
  color: "#fff",
  fontFamily: SERIF,
},
emailText: {
  fontSize: 16,      // ✅ match signup
  color: "rgba(255,255,255,0.85)",
  fontFamily: SERIF,
  textDecorationLine: "underline",
  textDecorationColor: "rgba(255,255,255,0.85)",
},


  topButtons: { flexDirection: "row", gap: 12 },

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

  label: {
    color: "rgba(255,255,255,0.92)",
    fontFamily: SERIF,
    marginBottom: 6,
    marginTop: 4,
    fontSize: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    color: "#fff",
    fontFamily: SERIF,
    fontSize: 16,
  },

  error: {
    color: "#ffd1d1",
    marginBottom: 10,
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

  buttonDisabled: { opacity: 0.45 },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: SERIF,
    fontSize: 16,
  },

  linkRow: { marginTop: 14, alignItems: "center" },

  linkText: {
    color: "rgba(255,255,255,0.9)",
    fontFamily: SERIF,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.9)",
  },
});

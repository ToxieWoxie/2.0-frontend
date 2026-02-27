// app/profile.tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../components/AuthProvider";
import { uploadAvatar, updateProfile } from "../lib/auth";
import { listProjects } from "../lib/db";

async function pickWebImage(): Promise<File | null> {
  if (Platform.OS !== "web") return null;

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0] ?? null;
      resolve(f);
    };
    input.click();
  });
}

export default function ProfileScreen() {
  const { user, refresh, loading } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ total: number } | null>(null);

  React.useEffect(() => {
    setUsername(user?.username ?? "");
    setBio(user?.bio ?? "");
  }, [user?.username, user?.bio]);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const p = await listProjects();
        setStats({ total: p.length });
      } catch {
        setStats({ total: 0 });
      }
    })();
  }, [user?.id]);

  const canSave = useMemo(() => !!user && !busy && username.trim().length >= 2, [user, busy, username]);

  if (!loading && !user) {
    return (
      <LinearGradient
        colors={["#061A40", "#0F766E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.center}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.sub}>You’re not logged in.</Text>
            <Pressable
              onPress={() => router.push({ pathname: "/login", params: { redirect: "/profile" } })}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Log in</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const avatarUri = user?.avatarUrl ?? undefined;

  const onChangePhoto = async () => {
    try {
      const f = await pickWebImage();
      if (!f) return;
      setBusy(true);
      const url = await uploadAvatar(f, f.type || "image/png");
      await updateProfile({ avatarUrl: url });
      await refresh();
    } catch (e: any) {
      Alert.alert("Avatar upload failed", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await updateProfile({ username: username.trim(), bio: bio.trim() });
      await refresh();
      Alert.alert("Saved", "Profile updated.");
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={["#061A40", "#0F766E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Your Profile</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.avatarWrap}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {(user?.username ?? "U").slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.rowRight}>
                <Text style={styles.label}>Photo</Text>
                <Pressable
                  onPress={onChangePhoto}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                  disabled={busy}
                >
                  <Text style={styles.secondaryText}>{busy ? "Working..." : "Change photo"}</Text>
                </Pressable>
                {Platform.OS !== "web" && <Text style={styles.note}>Photo editing is currently enabled on web.</Text>}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inline}>
                <TextInput value={username} onChangeText={setUsername} style={[styles.input, { flex: 1 }]} autoCapitalize="none" />
                <Pressable
                  onPress={onSave}
                  disabled={!canSave}
                  style={({ pressed }) => [styles.primaryMini, pressed && styles.pressed, !canSave && styles.disabled]}
                >
                  <Text style={styles.primaryMiniText}>Change</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bio</Text>
              <TextInput value={bio} onChangeText={setBio} style={[styles.input, styles.textArea]} multiline numberOfLines={4} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email ?? ""}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{stats?.total ?? "-"}</Text>
                <Text style={styles.statLabel}>Projects</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>—</Text>
                <Text style={styles.statLabel}>Tests taken</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>—</Text>
                <Text style={styles.statLabel}>Editors</Text>
              </View>
            </View>

            <Pressable
              onPress={onSave}
              disabled={!canSave}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, !canSave && styles.disabled]}
            >
              <Text style={styles.primaryText}>{busy ? "Saving..." : "Save profile"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

const styles = StyleSheet.create({
  gradient: { flex: 1 },

  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },

  container: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 120,
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },

  center: { flex: 1, padding: 16, justifyContent: "center", alignItems: "center", gap: 10 },

  title: {
    fontSize: 44,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    fontFamily: SERIF,
    marginTop: 16,
  },

  sub: { color: "rgba(255,255,255,0.85)", fontWeight: "600", fontFamily: SERIF },

  card: {
    marginTop: 18,
    backgroundColor: "rgba(38, 83, 108, 0.35)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  row: { flexDirection: "row", gap: 14, alignItems: "center", flexWrap: "wrap", rowGap: 12 },

  avatarWrap: { width: 72, height: 72 },

  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarFallbackText: { color: "#fff", fontWeight: "900", fontSize: 26, fontFamily: SERIF },

  rowRight: { flex: 1, gap: 8, minWidth: 220 },

  label: { fontWeight: "800", color: "#fff", fontFamily: SERIF },

  note: { color: "rgba(255,255,255,0.75)", fontWeight: "600", fontSize: 12, fontFamily: SERIF },

  field: { marginTop: 16, gap: 8 },

  inline: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap", rowGap: 10 },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontFamily: SERIF,
  },

  textArea: { minHeight: 110, textAlignVertical: "top" },

  value: { color: "rgba(255,255,255,0.9)", fontWeight: "700", fontFamily: SERIF },

  primaryBtn: {
    marginTop: 16,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    cursor: Platform.OS === "web" ? "pointer" : "auto",
  },

  primaryText: { color: "#fff", fontWeight: "bold", fontSize: 16, fontFamily: SERIF },

  primaryMini: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    cursor: Platform.OS === "web" ? "pointer" : "auto",
  },

  primaryMiniText: { color: "#fff", fontWeight: "bold", fontFamily: SERIF },

  secondaryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    cursor: Platform.OS === "web" ? "pointer" : "auto",
  },

  secondaryText: { color: "#fff", fontWeight: "600", fontFamily: SERIF },

  statsRow: { flexDirection: "row", gap: 12, marginTop: 16, flexWrap: "wrap", rowGap: 12 },

  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },

  statNum: { fontSize: 18, fontWeight: "900", color: "#fff", fontFamily: SERIF },

  statLabel: { marginTop: 2, color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 12, fontFamily: SERIF },

  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
});

// app/profile.tsx
import React, { useMemo, useState } from "react";
import { Alert, Image, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
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
                  <Text style={styles.avatarFallbackText}>{(user?.username ?? "U").slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
            </View>

            <View style={styles.rowRight}>
              <Text style={styles.label}>Photo</Text>
              <Pressable onPress={onChangePhoto} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} disabled={busy}>
                <Text style={styles.secondaryText}>{busy ? "Working..." : "Change photo"}</Text>
              </Pressable>
              {Platform.OS !== "web" && <Text style={styles.note}>Photo editing is currently enabled on web.</Text>}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inline}>
              <TextInput value={username} onChangeText={setUsername} style={[styles.input, { flex: 1 }]} autoCapitalize="none" />
              <Pressable onPress={onSave} disabled={!canSave} style={({ pressed }) => [styles.primaryMini, pressed && styles.pressed, !canSave && styles.disabled]}>
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

          <Pressable onPress={onSave} disabled={!canSave} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, !canSave && styles.disabled]}>
            <Text style={styles.primaryText}>{busy ? "Saving..." : "Save profile"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f7f7" },
  container: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, padding: 16, justifyContent: "center", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: "900", color: "#111" },
  sub: { color: "#666", fontWeight: "600" },
  card: { marginTop: 12, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#eee" },
  row: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatarWrap: { width: 72, height: 72 },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: "#fff", fontWeight: "900", fontSize: 26 },
  rowRight: { flex: 1, gap: 6 },
  label: { fontWeight: "800", color: "#111" },
  note: { color: "#666", fontWeight: "600", fontSize: 12 },
  field: { marginTop: 14, gap: 6 },
  inline: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: "#111" },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  value: { color: "#111", fontWeight: "700" },
  primaryBtn: { marginTop: 14, backgroundColor: "#111", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
  primaryMini: { backgroundColor: "#111", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  primaryMiniText: { color: "#fff", fontWeight: "900" },
  secondaryBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#eee", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryText: { color: "#111", fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  statCard: { flex: 1, borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, alignItems: "center" },
  statNum: { fontSize: 18, fontWeight: "900", color: "#111" },
  statLabel: { marginTop: 2, color: "#666", fontWeight: "700", fontSize: 12 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});

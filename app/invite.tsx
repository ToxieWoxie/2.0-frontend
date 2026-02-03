// app/invite.tsx
import React, { useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../components/AuthProvider";
import { acceptInvite } from "../lib/db";

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = useMemo(() => (typeof params.token === "string" ? params.token : "").trim(), [params.token]);

  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  const onAccept = async () => {
    if (!token) return Alert.alert("Invalid invite", "Missing token.");

    if (!loading && !user) {
      router.push({ pathname: "/login", params: { redirect: `/invite?token=${encodeURIComponent(token)}` } });
      return;
    }

    setBusy(true);
    try {
      const projectId = await acceptInvite(token);
      Alert.alert("Access granted", "You are now an editor.");
      router.replace({ pathname: "/edit/[id]", params: { id: projectId } });
    } catch (e: any) {
      Alert.alert("Invite failed", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Project invite</Text>
        <Text style={styles.sub}>Accept this invite to become an editor.</Text>

        <Pressable onPress={onAccept} disabled={busy} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.disabled]}>
          <Text style={styles.primaryText}>{busy ? "Accepting..." : "Accept invite"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f7f7" },
  container: { padding: 16, justifyContent: "center", flex: 1 },
  title: { fontSize: 22, fontWeight: "900", color: "#111" },
  sub: { marginTop: 8, color: "#666", fontWeight: "600" },
  primaryBtn: { marginTop: 16, backgroundColor: "#111", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});

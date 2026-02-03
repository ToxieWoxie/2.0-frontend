// components/AppHeader.tsx
import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "./AuthProvider";
import { logOut } from "../lib/auth";

function initials(username: string): string {
  const s = username.trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function AppHeader({ title = "Synesthete" }: { title?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const avatarText = useMemo(() => initials(user?.username ?? "User"), [user?.username]);

  return (
    <View style={styles.bar}>
      <Pressable onPress={() => router.push("/")} accessibilityRole="button">
        <Text style={styles.title}>{title}</Text>
      </Pressable>

      <View style={styles.right}>
        {!user ? (
          <View style={styles.authRow}>
            <Pressable onPress={() => router.push("/signup")} style={({ pressed }) => [styles.authBtn, pressed && styles.pressed]}>
              <Text style={styles.authText}>Sign up</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/login")} style={({ pressed }) => [styles.authBtn, pressed && styles.pressed]}>
              <Text style={styles.authText}>Log in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => setOpen(true)}
              style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Open profile menu"
            >
              <Text style={styles.avatarText}>{avatarText}</Text>
            </Pressable>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
              <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
                <View style={styles.menu} onStartShouldSetResponder={() => true}>
                  <MenuItem label="Profile" onPress={() => (setOpen(false), router.push("/profile"))} />
                  <MenuItem label="Settings" onPress={() => (setOpen(false), router.push("/settings"))} />
                  <MenuItem label="Projects" onPress={() => (setOpen(false), router.push("/library"))} />
                  <MenuItem label="Info" onPress={() => (setOpen(false), router.push("/info"))} />
                  <View style={styles.sep} />
                  <MenuItem
                    label="Sign out"
                    danger
                    onPress={async () => {
                      setOpen(false);
                      await logOut();
                      router.replace("/");
                    }}
                  />
                </View>
              </Pressable>
            </Modal>
          </>
        )}
      </View>
    </View>
  );
}

function MenuItem({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
      <Text style={[styles.menuText, danger && styles.menuDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#111" },
  right: { flexDirection: "row", alignItems: "center" },
  authRow: { flexDirection: "row", gap: 10 },
  authBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#111",
  },
  authText: { color: "#fff", fontWeight: "700" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800" },
  pressed: { opacity: 0.7 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "flex-start", alignItems: "flex-end" },
  menu: {
    marginTop: 56,
    marginRight: 12,
    width: 180,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
  menuText: { fontSize: 14, fontWeight: "700", color: "#111" },
  menuDanger: { color: "#c0392b" },
  sep: { height: 1, backgroundColor: "#eee" },
});

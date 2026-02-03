// Syn/components/ConfirmLogoutModal.tsx
// NEW FILE

import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  busy?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
};

export default function ConfirmLogoutModal({ visible, busy = false, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Log out?</Text>
          <Text style={styles.body}>Are you sure you want to log out?</Text>

          <View style={styles.row}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [styles.btn, pressed && styles.pressed, busy && styles.disabled]}
              accessibilityRole="button"
            >
              <Text style={styles.btnText}>No</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={busy}
              style={({ pressed }) => [styles.btn, pressed && styles.pressed, busy && styles.disabled]}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator /> : <Text style={styles.btnText}>Yes</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 14,
    padding: 18,
    backgroundColor: "rgba(38, 83, 108, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  body: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
});

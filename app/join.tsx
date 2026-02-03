// FILE: app/join.tsx
// (Join accepts: viewer code OR full links from Library share modal)
// ================================================================
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { joinByViewerCode } from "../lib/db";

const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

type ParsedJoin =
  | { kind: "take"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "code"; code: string }
  | { kind: "invalid" };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function parseJoinInput(raw: string): ParsedJoin {
  const input = String(raw ?? "").trim();
  if (!input) return { kind: "invalid" };

  // Treat as URL if it contains a slash route or starts with http(s)
  const looksLikeUrl =
    /^https?:\/\//i.test(input) ||
    input.includes("/take/") ||
    input.includes("/edit/") ||
    input.includes("/join") ||
    input.includes("?code=");

  if (!looksLikeUrl) {
    // viewer code fallback
    const code = input.trim().toUpperCase();
    return code.length >= 3 ? { kind: "code", code } : { kind: "invalid" };
  }

  // Try URL parsing (works for full links)
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `http://localhost${input.startsWith("/") ? "" : "/"}${input}`);
    const pathname = url.pathname || "";
    const codeParam = url.searchParams.get("code");

    if (codeParam && codeParam.trim().length >= 3) {
      return { kind: "code", code: codeParam.trim().toUpperCase() };
    }

    const takeMatch = pathname.match(/\/take\/([^/?#]+)/i);
    if (takeMatch?.[1]) return { kind: "take", id: safeDecode(takeMatch[1]).trim() };

    const editMatch = pathname.match(/\/edit\/([^/?#]+)/i);
    if (editMatch?.[1]) return { kind: "edit", id: safeDecode(editMatch[1]).trim() };

    // Allow users to paste just "/take/<id>" or "/edit/<id>" without host
    // Already handled by URL() above, but keep extra guard:
    if (/^\/take\//i.test(input)) {
      const id = safeDecode(input.replace(/^\/take\//i, "")).split(/[?#/]/)[0]?.trim();
      if (id) return { kind: "take", id };
    }
    if (/^\/edit\//i.test(input)) {
      const id = safeDecode(input.replace(/^\/edit\//i, "")).split(/[?#/]/)[0]?.trim();
      if (id) return { kind: "edit", id };
    }

    return { kind: "invalid" };
  } catch {
    // Regex fallback for "localhost:8081/take/<id>" without scheme, etc.
    const takeMatch = input.match(/\/take\/([^/?#]+)/i);
    if (takeMatch?.[1]) return { kind: "take", id: safeDecode(takeMatch[1]).trim() };

    const editMatch = input.match(/\/edit\/([^/?#]+)/i);
    if (editMatch?.[1]) return { kind: "edit", id: safeDecode(editMatch[1]).trim() };

    const codeMatch = input.match(/[?&]code=([^&]+)/i);
    if (codeMatch?.[1]) return { kind: "code", code: safeDecode(codeMatch[1]).trim().toUpperCase() };

    return { kind: "invalid" };
  }
}

export default function JoinScreen() {
  const [text, setText] = useState("");

  const parsed = useMemo(() => parseJoinInput(text), [text]);
  const disabled = useMemo(() => parsed.kind === "invalid", [parsed.kind]);

  const onSubmit = useCallback(async () => {
    try {
      const p = parseJoinInput(text);

      if (p.kind === "take") {
        router.replace({ pathname: "/take/[id]", params: { id: p.id } });
        return;
      }

      if (p.kind === "edit") {
        router.replace({ pathname: "/edit/[id]", params: { id: p.id } });
        return;
      }

      if (p.kind === "code") {
        const projectId = await joinByViewerCode(p.code);
        router.replace({ pathname: "/take/[id]", params: { id: projectId } });
        return;
      }

      Alert.alert("Join failed", "Please paste a valid link or enter a join code.");
    } catch (e: any) {
      Alert.alert("Join failed", String(e?.message ?? e));
    }
  }, [text]);

  return (
    <LinearGradient colors={["#061A40", "#0F766E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.content}>
            <View style={styles.card}>
              <Text style={styles.title}>Join</Text>
              <Text style={styles.subtitle}>Paste a viewer/editor link or enter a join code.</Text>

              <View style={styles.row}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Paste link or enter code"
                  placeholderTextColor="rgba(255,255,255,0.65)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                />

                <Pressable
                  onPress={onSubmit}
                  disabled={disabled}
                  style={({ pressed }) => [styles.btn, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Submit join"
                >
                  <Text style={styles.btnText}>Submit</Text>
                </Pressable>
              </View>

              {Platform.OS === "web" ? <Text style={styles.infoText}>info text</Text> : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, backgroundColor: "transparent" },

  content: { flex: 1, padding: 16, justifyContent: "center" },

  card: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.18)",
    padding: 18,
    gap: 12,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },

  title: { fontSize: 28, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  subtitle: { fontSize: 13, opacity: 0.85, color: "#fff", fontFamily: SERIF },

  row: { flexDirection: "row", gap: 10, alignItems: "center" },

  input: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.08)",
    fontFamily: SERIF,
  },

  btn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "900", fontFamily: SERIF },

  infoText: {
    marginTop: 2,
    fontSize: 12,
    opacity: 0.8,
    color: "#fff",
    fontFamily: SERIF,
  },

  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});

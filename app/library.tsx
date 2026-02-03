// FILE: Syn/app/library.tsx
// ===============================
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../components/AuthProvider";
import { deleteProject, ensureShareInfo, initDb, listProjects } from "../lib/db";
import type { ProjectListItem, ShareInfo } from "../lib/models";

const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

function formatWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function absoluteUrl(path: string): string {
  if (typeof window !== "undefined" && window.location?.origin) return `${window.location.origin}${path}`;
  return path;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const nav = (globalThis as unknown as { navigator?: any }).navigator;

    // Web
    if (Platform.OS === "web" && nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }

    // Native (Expo) — optional dependency: expo-clipboard
    const mod = await import("expo-clipboard").catch(() => null);
    if (mod?.setStringAsync) {
      await mod.setStringAsync(text);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export default function LibraryScreen() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [menuFor, setMenuFor] = useState<ProjectListItem | null>(null);

  // Share popup state
  const [shareFor, setShareFor] = useState<ProjectListItem | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  // ✅ single logged-out notice
  const shouldShowLoginNotice = !user;

  const cols = useMemo(() => {
    if (width >= 1100) return 4;
    if (width >= 820) return 3;
    if (width >= 520) return 2;
    return 1;
  }, [width]);

  const refresh = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await initDb();
      const items = await listProjects();
      setProjects(items);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(console.error);
    }, [refresh])
  );

  const onCreate = useCallback(() => {
    if (!user) return;
    router.push("/create");
  }, [user]);

  // ✅ CHANGED: clicking a project now opens the editor route
  const onOpen = useCallback(
    (id: string) => {
      if (!user) return;
      router.push({ pathname: "/edit/[id]", params: { id } });
    },
    [user]
  );

  const onEdit = useCallback(
    (id: string) => {
      if (!user) return;
      router.push({ pathname: "/edit/[id]", params: { id } });
    },
    [user]
  );

  const openShareModal = useCallback(
    async (p: ProjectListItem) => {
      if (!user) return;
      setShareFor(p);
      setShareInfo(null);
      setShareLoading(true);
      try {
        const info: ShareInfo = await ensureShareInfo(p.id);
        setShareInfo(info);
      } catch (e: any) {
        Alert.alert("Share failed", String(e?.message ?? e));
        setShareFor(null);
      } finally {
        setShareLoading(false);
      }
    },
    [user]
  );

  const closeShareModal = useCallback(() => {
    setShareFor(null);
    setShareInfo(null);
    setShareLoading(false);
  }, []);

  const onDelete = useCallback(
    (id: string) => {
      if (!user) return;

      Alert.alert("Delete project?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteProject(id);
            await refresh();
          },
        },
      ]);
    },
    [user, refresh]
  );

  const gap = 14;
  const cardW = useMemo(() => {
    const horizontal = 16 * 2;
    const totalGaps = gap * (cols - 1);
    return Math.floor((width - horizontal - totalGaps) / cols);
  }, [cols, width]);

  const shareViewerUrl = useMemo(() => {
    if (!shareFor) return "";
    // ✅ viewer link is /take/<id>
    return absoluteUrl(`/take/${encodeURIComponent(shareFor.id)}`);
  }, [shareFor]);

  const shareEditorUrl = useMemo(() => {
    if (!shareFor) return "";
    // ✅ editor link is /edit/<id>
    return absoluteUrl(`/edit/${encodeURIComponent(shareFor.id)}`);
  }, [shareFor]);

  const shareTitle = useMemo(() => {
    const title = shareFor?.title?.trim() ? shareFor.title : "Untitled";
    return shareInfo?.title?.trim() ? shareInfo.title : title;
  }, [shareFor, shareInfo]);

  const copyOrShow = useCallback(async (label: string, url: string) => {
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (ok) Alert.alert("Copied", `${label} link copied to clipboard.`);
    else Alert.alert("Copy this link", url);
  }, []);

  return (
    <LinearGradient colors={["#061A40", "#0F766E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.root}>
          {shouldShowLoginNotice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Log in required</Text>
              <Text style={styles.noticeBody}>Please log in to access your library and create projects.</Text>

              <View style={styles.noticeActions}>
                <Pressable onPress={() => router.push("/login")} style={({ pressed }) => [styles.noticeBtn, pressed && styles.pressed]}>
                  <Text style={styles.noticeBtnText}>Log In</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/signup")} style={({ pressed }) => [styles.noticeBtn, pressed && styles.pressed]}>
                  <Text style={styles.noticeBtnText}>Sign Up</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.topBar}>
              <View style={styles.topLeft}>
                <Text style={styles.header}>Library</Text>
                <Text style={styles.subheader}>{loading ? "Loading…" : `${projects.length} file(s)`}</Text>
              </View>

              <Pressable
                onPress={onCreate}
                style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Create new project"
              >
                <MaterialIcons name="add" size={20} color="#fff" />
                <Text style={styles.newBtnText}>New</Text>
              </Pressable>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.grid}>
            {projects.length === 0 && !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No projects yet</Text>
                <Text style={styles.emptyBody}>Create a project and it will stay here permanently.</Text>
                <Pressable onPress={onCreate} style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]}>
                  <Text style={styles.emptyBtnText}>Create</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.gridWrap, { gap }]}>
                {projects.map((p) => (
                  <Pressable key={p.id} onPress={() => onOpen(p.id)} style={({ pressed }) => [styles.card, { width: cardW }, pressed && styles.pressed]}>
                    <View style={styles.cardTop}>
                      <MaterialIcons name="description" size={28} color="#8ab4f8" />
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {p.title || "Untitled"}
                      </Text>
                    </View>

                    <View style={styles.cardBottom}>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {formatWhen(p.updatedAt)}
                      </Text>

                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setMenuFor(p);
                        }}
                        style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel="Project menu"
                      >
                        <MaterialIcons name="more-vert" size={20} color="rgba(255,255,255,0.85)" />
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </View>

        {/* Menu modal */}
        {user ? (
          <Modal visible={menuFor !== null} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setMenuFor(null)}>
              <View style={styles.menu}>
                <Text style={styles.menuTitle} numberOfLines={1}>
                  {menuFor?.title?.trim() ? menuFor.title : "Untitled"}
                </Text>

                <Pressable
                  onPress={() => {
                    if (!menuFor) return;
                    const id = menuFor.id;
                    setMenuFor(null);
                    onEdit(id);
                  }}
                  style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
                >
                  <MaterialIcons name="edit" size={18} color="#fff" />
                  <Text style={styles.menuText}>Edit</Text>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    if (!menuFor) return;
                    const p = menuFor;
                    setMenuFor(null);
                    await openShareModal(p);
                  }}
                  style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
                >
                  <MaterialIcons name="share" size={18} color="#fff" />
                  <Text style={styles.menuText}>Share</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (!menuFor) return;
                    const id = menuFor.id;
                    setMenuFor(null);
                    onDelete(id);
                  }}
                  style={({ pressed }) => [styles.menuItemDanger, pressed && styles.pressed]}
                >
                  <MaterialIcons name="delete" size={18} color="#fff" />
                  <Text style={styles.menuText}>Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        ) : null}

        {/* Share popup modal */}
        {user ? (
          <Modal visible={shareFor !== null} transparent animationType="fade" onRequestClose={closeShareModal}>
            <Pressable style={styles.modalBackdrop} onPress={closeShareModal}>
              <Pressable style={styles.shareCard} onPress={(e) => e.stopPropagation?.()}>
                <View style={styles.shareHeaderRow}>
                  <Text style={styles.shareTitle} numberOfLines={1}>
                    {shareTitle}
                  </Text>

                  <Pressable
                    onPress={closeShareModal}
                    style={({ pressed }) => [styles.shareCloseBtn, pressed && styles.pressed]}
                    accessibilityLabel="Close share popup"
                  >
                    <MaterialIcons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>

                <View style={styles.shareSection}>
                  <Text style={styles.shareSectionTitle}>Share to viewers</Text>
                  <Text style={styles.shareSectionSubtitle}>Opens the quiz take page</Text>

                  <View style={styles.shareRow}>
                    <Text style={styles.shareUrl} numberOfLines={1}>
                      {shareLoading ? "Loading…" : shareViewerUrl}
                    </Text>

                    <Pressable
                      onPress={() => copyOrShow("Viewer", shareViewerUrl)}
                      disabled={shareLoading || !shareViewerUrl}
                      style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed, (shareLoading || !shareViewerUrl) && styles.disabledBtn]}
                      accessibilityLabel="Copy viewer link"
                    >
                      <MaterialIcons name="content-copy" size={16} color="#fff" />
                      <Text style={styles.copyBtnText}>Copy</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.shareDivider} />

                <View style={styles.shareSection}>
                  <Text style={styles.shareSectionTitle}>Share to editors</Text>
                  <Text style={styles.shareSectionSubtitle}>Opens the synced edit page</Text>

                  <View style={styles.shareRow}>
                    <Text style={styles.shareUrl} numberOfLines={1}>
                      {shareLoading ? "Loading…" : shareEditorUrl}
                    </Text>

                    <Pressable
                      onPress={() => copyOrShow("Editor", shareEditorUrl)}
                      disabled={shareLoading || !shareEditorUrl}
                      style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed, (shareLoading || !shareViewerUrl) && styles.disabledBtn]}
                      accessibilityLabel="Copy editor link"
                    >
                      <MaterialIcons name="content-copy" size={16} color="#fff" />
                      <Text style={styles.copyBtnText}>Copy</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

// styles unchanged...
const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, backgroundColor: "transparent" },
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(38, 83, 108, 0.62)",
  },
  notice: {
    padding: 18,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.18)",
    gap: 8,
  },
  noticeTitle: { fontSize: 18, fontWeight: "800", color: "#fff", fontFamily: SERIF },
  noticeBody: { fontSize: 14, opacity: 0.9, color: "#fff", fontFamily: SERIF },
  noticeActions: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 6 },
  noticeBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  noticeBtnText: { color: "#fff", fontWeight: "800", fontFamily: SERIF },
  disabledBtn: { opacity: 0.6 },
  menuItemDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 90, 90, 0.18)",
  },
  topLeft: { gap: 2 },
  header: { fontSize: 28, fontWeight: "800", color: "#fff", fontFamily: SERIF },
  subheader: { fontSize: 13, opacity: 0.8, color: "#fff", fontFamily: SERIF },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  newBtnText: { color: "#fff", fontWeight: "800", fontFamily: SERIF },
  grid: { padding: 16, paddingBottom: 26 },
  gridWrap: { flexDirection: "row", flexWrap: "wrap" },
  card: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    padding: 12,
    minHeight: 110,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "web" ? 0 : 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardTop: { gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#fff", fontFamily: SERIF },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardMeta: { fontSize: 12, opacity: 0.85, flex: 1, marginRight: 8, color: "#fff", fontFamily: SERIF },
  moreBtn: { padding: 6, borderRadius: 999 },
  empty: {
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.18)",
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#fff", fontFamily: SERIF },
  emptyBody: { fontSize: 14, opacity: 0.9, color: "#fff", fontFamily: SERIF },
  emptyBtn: {
    marginTop: 6,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  emptyBtnText: { color: "#fff", fontWeight: "800", fontFamily: SERIF },
  pressed: { opacity: 0.75 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  menu: {
    width: 320,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 6,
    color: "#fff",
    fontFamily: SERIF,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  menuText: { fontSize: 14, fontWeight: "700", color: "#fff", fontFamily: SERIF },
  shareCard: {
    width: 520,
    maxWidth: "100%",
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  shareHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  shareTitle: { fontSize: 16, fontWeight: "900", color: "#fff", fontFamily: SERIF, flex: 1 },
  shareCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  shareSection: { gap: 8 },
  shareSectionTitle: { fontSize: 14, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  shareSectionSubtitle: { fontSize: 12, opacity: 0.85, color: "#fff", fontFamily: SERIF },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  shareUrl: { flex: 1, fontSize: 13, fontWeight: "700", color: "#fff", fontFamily: SERIF },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  copyBtnText: { color: "#fff", fontWeight: "900", fontFamily: SERIF, fontSize: 12 },
  shareDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)" },
});

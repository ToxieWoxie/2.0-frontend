import React, { ReactNode } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { BackButton } from "./BackButton";

export type PageProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  showBack?: boolean;
};

/**
 * Shared page layout for non-tab stack screens.
 */
export function Page({ title, subtitle, children, showBack = true }: PageProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {children}

        {showBack ? <BackButton /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.75,
    marginBottom: 12,
  },
});

import React from "react";
import { Stack } from "expo-router";

/**
 * Root stack navigator.
 *
 * The "(tabs)" group renders the bottom tab bar for the main app pages.
 * Auth and action pages (signup/login/create/join) are pushed on top as stack screens.
 */
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="create" />
      <Stack.Screen name="join" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
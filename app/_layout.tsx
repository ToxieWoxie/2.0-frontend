import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { AuthProvider } from "../components/AuthProvider";
import HomeButtonOverlay from "../components/HomeButtonOverlay";

export default function RootLayout() {
  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <HomeButtonOverlay />
      </View>
    </AuthProvider>
  );
}
import React from "react";
import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from "@/app";
import CreateScreen from "@/app/create";
import SignupScreen from "@/app/signup";
import ProfileScreen from "@/app/profile";
import SettingsScreen from "@/app/settings";
import JoinScreen from "@/app/join";
import LoginPage from "@/app/login";
const Stack = createNativeStackNavigator();

const RootStack = () => {
  return (
    <NavigationContainer> 
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Create" component={CreateScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Join" component={JoinScreen} />
        <Stack.Screen name="Login" component={LoginPage} />

      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default RootStack
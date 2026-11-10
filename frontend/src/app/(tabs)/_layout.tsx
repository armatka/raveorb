import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../theme/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 0.4,
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "index"
              ? "home"
              : route.name === "nights"
                ? "book"
              : route.name === "events"
                ? "calendar"
                : route.name === "venues"
                  ? "location"
                  : "bar-chart";

          const resolvedColor = typeof color === "string" ? color : colors.text;
          const resolvedSize = typeof size === "number" ? size : 24;

          return <Ionicons name={iconName as any} size={resolvedSize} color={resolvedColor} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="nights" options={{ title: "My Nights" }} />
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="venues" options={{ title: "Venues" }} />
      <Tabs.Screen name="stats" options={{ title: "Stats" }} />
    </Tabs>
  );
}

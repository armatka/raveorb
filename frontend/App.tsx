import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import HomeScreen from "./screens/HomeScreen";
import EventsScreen from "./screens/EventsScreen";
import VenuesScreen from "./screens/VenuesScreen";
import StatsScreen from "./screens/StatsScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
        />

        <Tab.Screen
          name="Events"
          component={EventsScreen}
        />

        <Tab.Screen
          name="Venues"
          component={VenuesScreen}
        />

        <Tab.Screen
          name="Stats"
          component={StatsScreen}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

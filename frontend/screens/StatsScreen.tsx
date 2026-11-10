import { View, Text } from "react-native";

export default function StatsScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <Text style={{ fontSize: 24 }}>
        Stats
      </Text>
    </View>
  );
}

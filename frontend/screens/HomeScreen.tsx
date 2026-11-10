import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <Text style={{ fontSize: 32, fontWeight: "bold" }}>
        RAVEORB
      </Text>

      <Text>Your personal rave journal</Text>
    </View>
  );
}

import { Redirect, useLocalSearchParams } from "expo-router";

// Preserve existing links while the canonical route uses Beacon.
export default function LegacyBeaconRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: "/beacon/[id]", params: { id } }} />;
}

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { EmptyState } from "../components/EmptyState";
import { NightForm } from "../components/NightForm";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { nightsStorage } from "../lib/nightsStorage";
import { colors } from "../theme/colors";
import type { Night, NightInput } from "../types/Night";

export default function EditNightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [night, setNight] = useState<Night | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    nightsStorage.get(id)
      .then((item) => {
        if (isCurrent) setNight(item);
      })
      .catch(() => {
        if (isCurrent) setError(true);
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });
    return () => { isCurrent = false; };
  }, [id]);

  const saveNight = async (input: NightInput) => {
    const updated = await nightsStorage.update(id, input);
    if (!updated) throw new Error("Night no longer exists");
    router.replace({ pathname: "/night/[id]", params: { id } });
  };

  if (loading) {
    return <Screen><View style={styles.center}><ActivityIndicator color={colors.primary} /></View></Screen>;
  }
  if (error || !night) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ScreenHeader title="Edit Night" onBack={() => router.back()} />
        <EmptyState title={error ? "Could not open night" : "Night not found"} message={error ? "Try again in a moment." : "This entry may have been removed from your journal."} icon="alert-circle-outline" />
      </Screen>
    );
  }

  return <NightForm key={night.id} heading="Edit Night" submitLabel="Save changes" initialNight={night} onSave={saveNight} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});

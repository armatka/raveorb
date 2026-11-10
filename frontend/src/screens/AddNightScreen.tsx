import { router } from "expo-router";

import { NightForm } from "../components/NightForm";
import { nightsStorage } from "../lib/nightsStorage";
import type { NightInput } from "../types/Night";

export default function AddNightScreen() {
  const saveNight = async (input: NightInput) => {
    const night = await nightsStorage.create(input);
    router.replace({ pathname: "/night/[id]", params: { id: night.id } });
  };

  return <NightForm heading="Add Night" submitLabel="Save to journal" onSave={saveNight} />;
}

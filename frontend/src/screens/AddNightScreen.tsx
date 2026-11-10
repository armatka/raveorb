import { router, useLocalSearchParams } from "expo-router";

import { NightForm } from "../components/NightForm";
import { nightsStorage } from "../lib/nightsStorage";
import type { NightInput } from "../types/Night";

type AddNightParams = {
  eventName?: string;
  date?: string;
  venueName?: string;
  city?: string;
  artists?: string;
};

export default function AddNightScreen() {
  const params = useLocalSearchParams<AddNightParams>();

  const initialValues: Partial<NightInput> = {
    eventName: params.eventName ?? "",
    date: params.date ?? new Date().toISOString().slice(0, 10),
    venueName: params.venueName ?? "",
    city: params.city ?? "",
    artistsSeen: params.artists
      ? params.artists.split("|").filter(Boolean)
      : [],
    friends: [],
    rating: 0,
    cost: 0,
    currency: "CAD",
    notes: "",
    favoriteMoment: "",
    photos: [],
  };

  const saveNight = async (input: NightInput) => {
    const existingNights = await nightsStorage.list();

    const existing = existingNights.find(
      (night) =>
        night.eventName.toLowerCase() === input.eventName.toLowerCase()
        && night.date === input.date
        && night.venueName.toLowerCase() === input.venueName.toLowerCase(),
    );

    if (existing) {
      router.replace({
        pathname: "/night/[id]",
        params: { id: existing.id },
      });
      return;
    }

    const night = await nightsStorage.create(input);

    router.replace({
      pathname: "/night/[id]",
      params: { id: night.id },
    });
  };

  return (
    <NightForm
      heading={params.eventName ? "Capture This Night" : "Add Night"}
      submitLabel="Save to journal"
      initialValues={initialValues}
      onSave={saveNight}
    />
  );
}

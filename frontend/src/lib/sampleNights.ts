import type { NightInput } from "../types/Night";
import { nightsStorage } from "./nightsStorage";
import { eventStatusStorage } from "./eventStatusStorage";
import { beaconStorage } from "./beaconStorage";
import { createSampleEvent, sampleEventStorage } from "./sampleEvent";

const samples: NightInput[] = [
  { date: "2026-01-09", eventName: "[Sample] Winter Frequencies", venueName: "The Lantern", city: "Toronto", artistsSeen: ["Nova Echo", "Glass Current"], friends: ["Sam", "Alex"], rating: 5, cost: 65, currency: "CAD", favoriteMoment: "The room lit up for the final track.", notes: "", photos: [] },
  { date: "2026-01-18", eventName: "[Sample] Sunday Afterglow", venueName: "Le Passage", city: "Montreal", artistsSeen: ["Nova Echo b2b Lunar Phase"], friends: ["Sam", "Maya"], rating: 4, cost: 45, currency: "CAD", favoriteMoment: "Dancing through the closing set.", notes: "", photos: [] },
  { date: "2026-03-14", eventName: "[Sample] Neon Assembly", venueName: "The Lantern", city: "Toronto", artistsSeen: ["Lunar Phase", "Static Bloom"], friends: ["Alex"], rating: 4, cost: 55, currency: "CAD", favoriteMoment: "A surprise remix brought everyone together.", notes: "", photos: [] },
  { date: "2026-04-24", eventName: "[Sample] Spring Circuit", venueName: "La Vague", city: "Montreal", artistsSeen: ["Glass Current", "Nova Echo"], friends: ["Maya", "Jordan"], rating: 5, cost: 42, currency: "USD", favoriteMoment: "The first sunrise on the terrace.", notes: "", photos: [] },
  { date: "2026-05-30", eventName: "[Sample] City Pulse", venueName: "Warehouse North", city: "Toronto", artistsSeen: ["Static Bloom", "Silver Lines"], friends: ["Jordan", "Sam"], rating: 3, cost: 70, currency: "CAD", favoriteMoment: "Finding a new favourite artist.", notes: "", photos: [] },
  { date: "2026-07-11", eventName: "[Sample] Summer Signals", venueName: "La Vague", city: "Montreal", artistsSeen: ["Lunar Phase", "Silver Lines"], friends: ["Maya"], rating: 5, cost: 58, currency: "USD", favoriteMoment: "The crowd singing along outside.", notes: "", photos: [] },
  { date: "2026-09-19", eventName: "[Sample] Midnight Transit", venueName: "Warehouse North", city: "Toronto", artistsSeen: ["Nova Echo", "Static Bloom"], friends: ["Alex", "Jordan"], rating: 4, cost: 60, currency: "CAD", favoriteMoment: "Meeting friends on the dance floor.", notes: "", photos: [] },
  { date: "2026-11-07", eventName: "[Sample] Northern Lights", venueName: "Le Passage", city: "Montreal", artistsSeen: ["Glass Current", "Lunar Phase"], friends: ["Sam", "Maya"], rating: 5, cost: 48, currency: "CAD", favoriteMoment: "The last track of the night.", notes: "", photos: [] },
];

export async function loadSampleNights(): Promise<void> {
  for (const sample of samples) await nightsStorage.create(sample);
  await removeSampleEvent();
  const event = createSampleEvent();
  await sampleEventStorage.set(event);
  await eventStatusStorage.set(event.id, "going", event);
}

async function removeSampleEvent(): Promise<void> {
  const event = await sampleEventStorage.get();
  if (!event) return;
  await eventStatusStorage.remove(event.id);
  await beaconStorage.remove(event.id);
  await sampleEventStorage.remove();
}

export async function removeSampleNights(): Promise<void> {
  const nights = await nightsStorage.list();
  for (const night of nights) {
    if (night.eventName.startsWith("[Sample]")) await nightsStorage.remove(night.id);
  }
  await removeSampleEvent();
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EventEntry } from "../types/event";
import { beaconStorage } from "./beaconStorage";
import { eventStatusStorage } from "./eventStatusStorage";
import { createFestivalPlan, festivalDays } from "./festivalPlanner";
import { festivalPlannerStorage } from "./festivalPlannerStorage";

export const SAMPLE_FESTIVAL_ID = "raveorb-local-sample-festival";
const KEY = "raveorb.sample-festival.v1";

export const sampleFestivalStorage = {
  async get(): Promise<unknown> {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored === null) return null;
    try { return JSON.parse(stored); } catch { throw new Error("Sample festival could not be read."); }
  },
};

export async function removeSampleFestival(): Promise<void> {
  await eventStatusStorage.remove(SAMPLE_FESTIVAL_ID);
  await beaconStorage.remove(SAMPLE_FESTIVAL_ID);
  await festivalPlannerStorage.remove(SAMPLE_FESTIVAL_ID);
  await AsyncStorage.removeItem(KEY);
}

export async function loadSampleFestival(): Promise<EventEntry> {
  await removeSampleFestival();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const days = festivalDays(date, new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10));
  const event: EventEntry = {
    id: SAMPLE_FESTIVAL_ID, title: "[Sample] Signal Fields", type: "festival", isFestival: true,
    venueId: "sample-festival-venue", venueName: "Signal Fields", city: "Toronto", countryCode: "CA",
    date, startTime: "18:00", endTime: "04:00", timezone: "America/Toronto",
    artists: ["Nova Echo", "Glass Current", "Lunar Phase", "Static Bloom", "Silver Lines", "Night Circuit", "Solar Drift", "Echo Field", "Pulse Theory", "Distant Light"],
    genres: ["Electronic"], description: "A fictional festival for testing the planner.", source: "raveorb-local-sample",
    status: "scheduled",
  };
  const stages = ["Orbit", "Pulse", "Horizon"];
  const plan = createFestivalPlan(event);
  plan.days = days;
  plan.stages = stages;
  plan.sets = plan.sets.map((set, index) => ({
    ...set, day: days[index < 6 ? 0 : 1], stage: stages[index % stages.length],
    start: ["19:00", "20:00", "21:00", "22:00", "23:30", "01:00", "19:00", "20:00", "21:00", "22:00"][index],
    end: ["20:00", "21:00", "22:00", "23:00", "01:30", "02:00", "20:00", "21:00", "22:00", "23:00"][index],
    starred: index === 4 || index === 5,
  }));
  await AsyncStorage.setItem(KEY, JSON.stringify(event));
  await festivalPlannerStorage.set(plan);
  await eventStatusStorage.set(event.id, "going", event);
  return event;
}

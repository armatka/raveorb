import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CurrencyCode, Night, NightInput } from "../types/Night";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

const STORAGE_KEY = "raveorb.nights.v1";
const PHOTO_DIRECTORY_NAME = "night-photos";

export async function persistNightPhotos(photos: string[]): Promise<string[]> {
  if (Platform.OS === "web") return photos;

  const directory = new Directory(Paths.document, PHOTO_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  const directoryPrefix = directory.uri.endsWith("/") ? directory.uri : `${directory.uri}/`;

  return Promise.all(photos.map(async (uri, index) => {
    if (uri.startsWith(directoryPrefix)) return uri;

    const source = new File(uri);
    const extension = source.extension || ".jpg";
    const destination = new File(directory, `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}${extension}`);
    await source.copy(destination);
    return destination.uri;
  }));
}

function removeManagedPhotos(photos: string[]): void {
  if (Platform.OS === "web") return;
  const directory = new Directory(Paths.document, PHOTO_DIRECTORY_NAME);
  const directoryPrefix = directory.uri.endsWith("/") ? directory.uri : `${directory.uri}/`;

  for (const uri of photos) {
    if (!uri.startsWith(directoryPrefix)) continue;
    try {
      new File(uri).delete();
    } catch {
      // Journal data should remain usable if a photo was already removed externally.
    }
  }
}

function sortNewestFirst(nights: Night[]): Night[] {
  return [...nights].sort((first, second) => second.date.localeCompare(first.date));
}

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return value === "CAD" || value === "USD" || value === "EUR";
}

function isNight(value: unknown): value is Omit<Night, "currency"> & { currency?: unknown } {
  if (!value || typeof value !== "object") return false;
  const night = value as Partial<Night>;
  return typeof night.id === "string"
    && (night.sourceEventId === undefined || typeof night.sourceEventId === "string")
    && typeof night.date === "string"
    && typeof night.eventName === "string"
    && typeof night.venueName === "string"
    && typeof night.city === "string"
    && Array.isArray(night.artistsSeen)
    && night.artistsSeen.every((artist) => typeof artist === "string")
    && Array.isArray(night.friends)
    && night.friends.every((friend) => typeof friend === "string")
    && typeof night.rating === "number"
    && typeof night.cost === "number"
    && (night.currency === undefined || isCurrencyCode(night.currency))
    && typeof night.notes === "string"
    && typeof night.favoriteMoment === "string"
    && Array.isArray(night.photos)
    && night.photos.every((photo) => typeof photo === "string")
    && typeof night.createdAt === "string"
    && typeof night.updatedAt === "string";
}

function normalizeNight(value: Omit<Night, "currency"> & { currency?: unknown }): Night {
  return {
    ...value,
    currency: isCurrencyCode(value.currency) ? value.currency : "USD",
  };
}

async function readAll(): Promise<Night[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error("Journal data could not be read.");
  }
  if (!Array.isArray(parsed) || !parsed.every(isNight)) {
    throw new Error("Journal data contains unsupported records.");
  }
  const nights = parsed.map(normalizeNight);
  if (parsed.some((night) => night.currency === undefined)) {
    await writeAll(nights);
  }
  return sortNewestFirst(nights);
}

async function writeAll(nights: Night[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sortNewestFirst(nights)));
}

function createId(): string {
  return `night-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const nightsStorage = {
  async list(): Promise<Night[]> {
    return readAll();
  },

  async get(id: string): Promise<Night | null> {
    const nights = await readAll();
    return nights.find((night) => night.id === id) ?? null;
  },

  async getBySourceEventId(sourceEventId: string): Promise<Night | null> {
    const nights = await readAll();
    return nights.find((night) => night.sourceEventId === sourceEventId) ?? null;
  },

  async create(input: NightInput): Promise<Night> {
    const nights = await readAll();
    const now = new Date().toISOString();
    const night: Night = { ...input, id: createId(), createdAt: now, updatedAt: now };
    await writeAll([night, ...nights]);
    return night;
  },

  async update(id: string, input: NightInput): Promise<Night | null> {
    const nights = await readAll();
    const existing = nights.find((night) => night.id === id);
    if (!existing) return null;

    const updated: Night = { ...existing, ...input, updatedAt: new Date().toISOString() };
    await writeAll(nights.map((night) => (night.id === id ? updated : night)));
    removeManagedPhotos(existing.photos.filter((photo) => !updated.photos.includes(photo)));
    return updated;
  },

  async remove(id: string): Promise<void> {
    const nights = await readAll();
    await writeAll(nights.filter((night) => night.id !== id));
    removeManagedPhotos(nights.find((night) => night.id === id)?.photos ?? []);
  },
};

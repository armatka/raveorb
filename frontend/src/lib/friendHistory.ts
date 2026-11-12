import type { Night } from "../types/Night";

export function normalizeFriendName(name: string): string {
  return name.trim().toLowerCase();
}

type NameCount = { label: string; count: number };

function countNames(nights: Night[], select: (night: Night) => string[]): NameCount[] {
  const counts = new Map<string, NameCount>();
  for (const night of nights) {
    const seen = new Set<string>();
    for (const name of select(night)) {
      const key = normalizeFriendName(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const previous = counts.get(key);
      if (previous) previous.count += 1;
      else counts.set(key, { label: name.trim(), count: 1 });
    }
  }
  return [...counts.values()].sort((first, second) => second.count - first.count || first.label.localeCompare(second.label));
}

export function getFriendHistory(name: string, nights: Night[]) {
  const key = normalizeFriendName(name);
  const matching = key ? nights.filter((night) => night.friends.some((friend) => normalizeFriendName(friend) === key))
    .sort((first, second) => second.date.localeCompare(first.date) || second.updatedAt.localeCompare(first.updatedAt)) : [];
  const displayName = matching.flatMap((night) => night.friends).find((friend) => normalizeFriendName(friend) === key)?.trim() ?? "";
  const cities = countNames(matching, (night) => [night.city]);
  const venues = countNames(matching, (night) => [night.venueName]);
  const artists = countNames(matching, (night) => night.artistsSeen);
  const ratings = matching.map((night) => night.rating).filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const photoUris = new Set<string>();
  const photos = matching.flatMap((night) => night.photos.flatMap((uri) => {
    if (!uri || photoUris.has(uri)) return [];
    photoUris.add(uri);
    return [{ uri, nightId: night.id, eventName: night.eventName }];
  }));
  return {
    name: displayName,
    nights: matching,
    cities,
    venues,
    artists,
    photos,
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    mostRecentNight: matching[0] ?? null,
    mostFrequentArtist: artists[0] ?? null,
    mostFrequentVenue: venues[0] ?? null,
  };
}
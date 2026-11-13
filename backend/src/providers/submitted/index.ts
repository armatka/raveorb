import type { EventProvider, EventSearchQuery } from "../types.js";
import type { EventEntry } from "../../types/index.js";
import { getDefaultSubmissionStore, type Submission, type SubmissionStore } from "../../db/submissions.js";

const earthRadiusKm = 6371.0088;

function dateInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isUpcoming(submission: Submission): boolean {
  return submission.date >= dateInTimeZone(submission.timezone);
}

function distanceKm(firstLat: number, firstLon: number, secondLat: number, secondLon: number): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(secondLat - firstLat);
  const longitudeDelta = toRadians(secondLon - firstLon);
  const halfChord = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(firstLat)) * Math.cos(toRadians(secondLat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(halfChord));
}

function toEvent(submission: Submission): EventEntry {
  return {
    id: `submitted-${submission.id}`,
    sourceEventId: submission.id,
    title: submission.title,
    type: submission.style === "Festival" ? "festival" : "rave",
    venueId: `submitted-venue-${submission.id}`,
    venueName: submission.venueName,
    city: submission.city,
    countryCode: submission.countryCode,
    province: submission.region || undefined,
    address: submission.address,
    latitude: submission.latitude,
    longitude: submission.longitude,
    date: submission.date,
    startTime: submission.startTime,
    endTime: submission.endTime,
    timezone: submission.timezone,
    artists: submission.artists,
    genre: submission.style,
    genres: [submission.style],
    description: submission.description,
    ...(submission.ticketUrl ? { ticketUrl: submission.ticketUrl, eventUrl: submission.ticketUrl } : {}),
    ...(submission.priceMin !== undefined ? { priceMin: submission.priceMin } : {}),
    ...(submission.priceMax !== undefined ? { priceMax: submission.priceMax } : {}),
    ...(submission.currency ? { currency: submission.currency } : {}),
    ...(submission.ageRestriction ? { ageRestriction: submission.ageRestriction } : {}),
    source: "submitted",
    status: "scheduled",
  };
}

function matches(submission: Submission, query: EventSearchQuery): boolean {
  if (query.keyword) {
    const searchable = [submission.title, submission.description, submission.venueName, ...submission.artists].join(" ").toLocaleLowerCase();
    if (!searchable.includes(query.keyword.toLocaleLowerCase())) return false;
  }
  const startDate = query.localStartDate ?? query.startDateTime?.slice(0, 10);
  const endDate = query.localEndDate ?? query.endDateTime?.slice(0, 10);
  if (startDate && submission.date < startDate) return false;
  if (endDate && submission.date > endDate) return false;

  if (query.latlong && query.radius !== undefined) {
    const [latitude, longitude] = query.latlong.split(",").map(Number);
    const distance = distanceKm(latitude, longitude, submission.latitude, submission.longitude);
    const radiusKm = query.unit === "miles" ? query.radius * 1.609344 : query.radius;
    if (distance > radiusKm) return false;
  } else {
    if (query.city && submission.city.toLocaleLowerCase() !== query.city.toLocaleLowerCase()) return false;
    if (query.countryCode && submission.countryCode !== query.countryCode.toUpperCase()) return false;
  }
  return true;
}

export function createSubmittedProvider(store: SubmissionStore): EventProvider {
  return {
    id: "submitted",
    displayName: "Community submissions",
    isConfigured: () => store.list("approved").some(isUpcoming),
    async search(query) {
      const allMatches = store.list("approved")
        .filter(isUpcoming)
        .filter((submission) => matches(submission, query))
        .map(toEvent);
      return {
        events: query.page === 0 ? allMatches : [],
        page: query.page,
        totalPages: allMatches.length ? 1 : 0,
        totalElements: allMatches.length,
      };
    },
    async getById(sourceEventId) {
      const submission = store.get(sourceEventId);
      return submission?.status === "approved" && isUpcoming(submission)
        ? toEvent(submission)
        : null;
    },
  };
}

export const submittedProvider = createSubmittedProvider({
  create: (input) => getDefaultSubmissionStore().create(input),
  get: (id) => getDefaultSubmissionStore().get(id),
  list: (status) => getDefaultSubmissionStore().list(status),
  approve: (id) => getDefaultSubmissionStore().approve(id),
  reject: (id, reason) => getDefaultSubmissionStore().reject(id, reason),
  remove: (id) => getDefaultSubmissionStore().remove(id),
});

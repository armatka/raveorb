export type EventType = "festival" | "rave" | "concert" | "club";
export type EventStatus = "scheduled" | "cancelled" | "postponed" | "sold-out";
export type EventCurrency = "CAD" | "USD" | "EUR";

export interface EventEntry {
  id: string;
  title: string;
  type: EventType;
  venueId: string;
  venueName: string;
  city: string;
  countryCode: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  artists: string[];
  genres: string[];
  description: string;
  imageUrl?: string;
  ticketUrl?: string;
  eventUrl?: string;
  priceMin?: number;
  priceMax?: number;
  currency?: EventCurrency;
  source: string;
  sourceEventId?: string;
  ageRestriction?: string;
  status?: EventStatus;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  countryCode?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  type: string;
  visits: number;
  favoriteGenre: string;
}

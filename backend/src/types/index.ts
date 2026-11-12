export type EventType = "festival" | "rave" | "concert" | "club";
export type EventStatus = "scheduled" | "cancelled" | "postponed" | "sold-out";
export type EventCurrency = string;

export interface EventEntry {
  id: string;
  title: string;
  type: EventType;
  venueId: string;
  venueName: string;
  city: string;
  countryCode: string;
  province?: string;
  country?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  date: string;
  dateTime?: string;
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
  ticketSaleStartDateTime?: string;
  ticketSaleEndDateTime?: string;
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

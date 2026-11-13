export type EventType = "festival" | "rave" | "concert" | "club";
export type EventStatus = "scheduled" | "cancelled" | "postponed" | "sold-out";
export type EventCurrency = string;
export const raveOrbCategories = [
  "House",
  "Tech House",
  "Deep House",
  "Minimal / Deep Tech",
  "Techno",
  "Hard Techno",
  "Melodic House & Techno",
  "Trance",
  "Progressive",
  "Drum & Bass",
  "Dubstep / Bass",
  "Garage",
  "EDM",
  "Electronic",
  "Festival",
  "Other",
] as const;
export type RaveOrbCategory = (typeof raveOrbCategories)[number];

export type TicketmasterClassificationValue = {
  id?: string;
  name?: string;
};

export type TicketmasterClassification = {
  segment?: TicketmasterClassificationValue;
  genre?: TicketmasterClassificationValue;
  subGenre?: TicketmasterClassificationValue;
  type?: TicketmasterClassificationValue;
  subType?: TicketmasterClassificationValue;
};

export type ElectronicClassification = {
  category: RaveOrbCategory;
  subgenre: string | null;
  electronicScore: number;
  isElectronic: boolean;
  matchedTerms: string[];
  classificationReasons: string[];
  isFestival: boolean;
};

export interface EventEntry {
  id: string;
  title: string;
  type: EventType;
  venueId: string;
  venueName: string;
  city: string;
  countryCode: string;
  segment?: string;
  genre?: string;
  subgenre?: string;
  classifications?: TicketmasterClassification[];
  raveOrbCategory?: RaveOrbCategory;
  raveOrbSubgenre?: string | null;
  electronicScore?: number;
  isElectronic?: boolean;
  isFestival?: boolean;
  matchedTerms?: string[];
  classificationReasons?: string[];
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

export type DiscoveryLocation = {
  label: string;
  city: string;
  region?: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

export type CitySearchResult = DiscoveryLocation & {
  id: string;
  country?: string;
  latitude: number;
  longitude: number;
  population?: number;
};

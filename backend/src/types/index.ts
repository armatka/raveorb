export type EventType = "festival" | "rave" | "concert" | "club";

export interface EventEntry {
  id: string;
  title: string;
  type: EventType;
  venueId: string;
  city: string;
  date: string;
  startTime: string;
  endTime: string;
  artists: string[];
  spend: number;
  vibeScore: number;
  durationHours: number;
  notes: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  type: string;
  visits: number;
  favoriteGenre: string;
}

export type CurrencyCode = "CAD" | "USD" | "EUR";

export type Night = {
  id: string;
  date: string;
  eventName: string;
  venueName: string;
  city: string;
  artistsSeen: string[];
  friends: string[];
  rating: number;
  cost: number;
  currency: CurrencyCode;
  notes: string;
  favoriteMoment: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
};

export type NightInput = Omit<Night, "id" | "createdAt" | "updatedAt">;

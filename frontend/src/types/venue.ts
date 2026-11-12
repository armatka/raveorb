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

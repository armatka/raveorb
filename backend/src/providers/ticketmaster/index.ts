import { EventQueryError, type EventProvider } from "../types.js";
import { getTicketmasterEvent, searchTicketmasterEvents } from "./client.js";

export const ticketmasterProvider: EventProvider = {
  id: "ticketmaster",
  displayName: "Ticketmaster",
  isConfigured: () => Boolean(process.env.TICKETMASTER_API_KEY?.trim()),
  queryKeys: ["classificationName", "genreId", "genre", "type"],
  parseQuery(value) {
    const classificationName = value("classificationName") ?? "Music";
    const genreId = value("genreId");
    const type = value("type");
    if (type && !["festival", "rave", "concert", "club"].includes(type)) {
      throw new EventQueryError("type is not supported.");
    }
    const genre = value("genre");
    return {
      classificationName,
      ...(genreId ? { genreId } : {}),
      ...(type ? { type } : {}),
      ...(genre ? { genre } : {}),
    };
  },
  search: searchTicketmasterEvents,
  getById: getTicketmasterEvent,
};

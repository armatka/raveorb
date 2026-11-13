import { ticketmasterProvider } from "./ticketmaster/index.js";
import type { EventProvider } from "./types.js";

export const providers: readonly EventProvider[] = [ticketmasterProvider];

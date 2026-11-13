import { ticketmasterProvider } from "./ticketmaster/index.js";
import { submittedProvider } from "./submitted/index.js";
import type { EventProvider } from "./types.js";

export const providers: readonly EventProvider[] = [ticketmasterProvider, submittedProvider];

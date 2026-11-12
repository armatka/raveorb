export type EventsApiQuery = {
  keyword?: string;
  city?: string;
  countryCode?: string;
  postalCode?: string;
  latlong?: string;
  radius?: number;
  unit?: "km" | "miles";
  classificationName?: string;
  genreId?: string;
  startDateTime?: string;
  endDateTime?: string;
  page?: number;
  size?: number;
  sort?: string;
};

export class EventsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "EventsApiError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";

export function getEventsApiBaseUrl(): string {
  return apiBaseUrl;
}

export function hasEventsApi(): boolean {
  return Boolean(apiBaseUrl);
}

function errorMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    const message = (payload as Record<string, unknown>).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return `The event service returned an error (${status}).`;
}

export async function requestEventsApi(path: string): Promise<{ payload: unknown; response: Response }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (response.ok) throw new Error("The event service returned invalid JSON.", { cause: error });
      payload = null;
    }
    if (!response.ok) throw new EventsApiError(errorMessage(payload, response.status), response.status);
    return { payload, response };
  } catch (error) {
    if (error instanceof EventsApiError) throw error;
    if (error instanceof Error && error.message === "The event service returned invalid JSON.") throw error;
    if (controller.signal.aborted) throw new Error("The event service timed out. Check your connection and retry.");
    throw new Error("The event service could not be reached. Check the API URL and connection.", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

export function serializeEventsQuery(query: EventsApiQuery): string {
  const params = new URLSearchParams();
  for (const key of ["keyword", "city", "countryCode", "postalCode", "latlong", "radius", "unit", "classificationName", "genreId", "startDateTime", "endDateTime", "page", "size", "sort"] as const) {
    const value = query[key];
    if (value !== undefined && String(value).trim()) params.set(key, String(value).trim());
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function readPageHeader(response: Response, header: string, fallback: number): number {
  const value = Number(response.headers.get(header));
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

import { cancelledCalendarTitle, type CalendarEventDetails } from "../lib/calendarEventDetails";
import { calendarLinkStorage } from "../lib/calendarLinkStorage";

function toEventPayload(details: CalendarEventDetails) {
  return {
    title: details.title,
    location: details.location,
    notes: details.notes,
    startDate: details.startDate,
    endDate: details.endDate,
    ...(details.timeZone ? { timeZone: details.timeZone } : {}),
    alarms: [{ relativeOffset: details.alarmOffsetMinutes }],
  };
}

async function defaultCalendar(Calendar: typeof import("expo-calendar")) {
  if (Platform.OS === "ios") return Calendar.getDefaultCalendarSync();
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((calendar) => calendar.allowsModifications);
  const target = writable.find((calendar) => calendar.isPrimary) ?? writable[0];
  if (!target) throw new Error("No writable calendar was found on this device.");
  return target;
}

export const calendarService = {
  /** The native calendar module is unavailable on web and in Expo Go (requires a development build). */
  isAvailable(): boolean {
    return Platform.OS !== "web" && !isRunningInExpoGo();
  },
  async hasPermission(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const Calendar = await import("expo-calendar");
    return (await Calendar.getCalendarPermissions()).granted;
  },
  async ensurePermission(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const Calendar = await import("expo-calendar");
    const current = await Calendar.getCalendarPermissions();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Calendar.requestCalendarPermissions()).granted;
  },
  async addEvent(details: CalendarEventDetails): Promise<string | null> {
    if (!this.isAvailable()) return null;
    const Calendar = await import("expo-calendar");
    const calendar = await defaultCalendar(Calendar);
    const created = await calendar.createEvent(toEventPayload(details));
    return created.id;
  },
  async eventExists(calendarEventId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const Calendar = await import("expo-calendar");
    try {
      await Calendar.ExpoCalendarEvent.get(calendarEventId);
      return true;
    } catch {
      return false;
    }
  },
  async rescheduleEvent(calendarEventId: string, details: CalendarEventDetails): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const Calendar = await import("expo-calendar");
    const calendarEvent = await Calendar.ExpoCalendarEvent.get(calendarEventId);
    await calendarEvent.update({
      startDate: details.startDate,
      endDate: details.endDate,
      ...(details.timeZone ? { timeZone: details.timeZone } : {}),
    });
    return true;
  },
  async markCancelled(calendarEventId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const Calendar = await import("expo-calendar");
    const calendarEvent = await Calendar.ExpoCalendarEvent.get(calendarEventId);
    await calendarEvent.update({ title: cancelledCalendarTitle(calendarEvent.title) });
    return true;
  },
  /**
   * Returns the linked calendar event id for a RaveOrb event, clearing the link
   * when the user has deleted the event from their calendar so it can be re-added.
   */
  async resolveLinkedEvent(eventId: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    const linked = await calendarLinkStorage.get(eventId);
    if (!linked) return null;
    if (!(await this.hasPermission())) return linked;
    if (await this.eventExists(linked)) return linked;
    await calendarLinkStorage.remove(eventId);
    return null;
  },
};

import { Ionicons } from "@expo/vector-icons";
import { useCalendars, useLocales } from "expo-localization";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../components/EmptyState";
import { Screen } from "../components/Screen";
import { nightPrefill } from "../lib/beacon";
import { formatCalendarDate, parseCalendarDate } from "../lib/calendarDate";
import { eventStatusStorage, type TrackedEvent } from "../lib/eventStatusStorage";
import { nightsStorage } from "../lib/nightsStorage";
import { calendarItems, filterCalendarItems, monthGrid, shiftMonth, weekStartsOn, type CalendarFilter, type CalendarItem } from "../lib/raveCalendar";
import { backfillCalendarEvents } from "../services/calendarBackfill";
import { refreshTrackedEvents } from "../services/eventChangesService";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Night } from "../types/Night";

const kinds = {
  going: { label: "Going", color: colors.success, icon: "calendar-outline" },
  interested: { label: "Interested", color: colors.secondary, icon: "heart-outline" },
  attended: { label: "Attended", color: "#bca4ff", icon: "checkmark-circle-outline" },
} as const;
const filters: { value: CalendarFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "going", label: "Going" },
  { value: "interested", label: "Interested" }, { value: "attended", label: "Attended" },
];

export default function CalendarScreen() {
  const [calendar] = useCalendars();
  const [locale] = useLocales();
  const [selected, setSelected] = useState(() => formatCalendarDate(new Date()));
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [entries, setEntries] = useState<Record<string, TrackedEvent>>({});
  const [nights, setNights] = useState<Night[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(useCallback(() => {
    let active = true;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    const load = async () => {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const [saved, journal] = await Promise.all([eventStatusStorage.listTracked(), nightsStorage.list()]);
        if (!active) return;
        setEntries(saved);
        setNights(journal);
        setLoading(false);

        try {
          let refreshFailed = false;
          const result = await backfillCalendarEvents();
          if (!result.offline) {
            try { await refreshTrackedEvents(new Set(result.candidates)); } catch { refreshFailed = true; }
          }
          const updated = await eventStatusStorage.listTracked();
          if (!active) return;
          setEntries(updated);
          const unavailable = Object.keys(updated).filter((id) => !updated[id].snapshot && result.failed.includes(id)).length;
          if (unavailable) setNotice(`${unavailable} saved event${unavailable === 1 ? "" : "s"}: details unavailable. Retry when online.`);
          else if (result.pending) setNotice("Some saved event details are waiting for the next refresh.");
          else if (refreshFailed || result.failed.length) setNotice("Some saved event updates could not be refreshed.");
        } catch {
          if (active) setNotice("Saved event updates could not be refreshed.");
        }
      } catch {
        if (active) setError("Calendar data could not be loaded. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; clearInterval(timer); };
    // Retry reruns the focused load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]));

  const date = parseCalendarDate(selected);
  const year = Number(selected.slice(0, 4));
  const month = Number(selected.slice(5, 7)) - 1;
  const firstDay = weekStartsOn(calendar.firstWeekday, locale.languageTag);
  const grid = useMemo(() => monthGrid(year, month, firstDay), [year, month, firstDay]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale.languageTag, { weekday: "short" }).format(new Date(2024, 0, 7 + (firstDay + index) % 7, 12))),
  [locale.languageTag, firstDay]);
  const items = useMemo(() => filterCalendarItems(calendarItems(entries, nights, now), filter), [entries, nights, filter, now]);
  const byDay = useMemo(() => {
    const result = new Map<string, CalendarItem[]>();
    for (const item of items) result.set(item.date, [...(result.get(item.date) ?? []), item]);
    return result;
  }, [items]);
  const dayItems = byDay.get(selected) ?? [];
  const monthLabel = new Intl.DateTimeFormat(locale.languageTag, { month: "long", year: "numeric" }).format(new Date(year, month, 1, 12));
  const dayLabel = date ? new Intl.DateTimeFormat(locale.languageTag, { dateStyle: "full" }).format(date) : selected;

  const openItem = (item: CalendarItem) => {
    if (item.nightId) router.push({ pathname: "/night/[id]", params: { id: item.nightId } });
    else if (item.eventId) router.push({ pathname: "/event/[id]", params: { id: item.eventId } });
  };
  const logNight = (item: CalendarItem) => {
    if (!item.snapshot || !item.eventId) return;
    router.push({ pathname: "/night/new", params: nightPrefill({
      id: item.eventId, ...item.snapshot, artists: item.snapshot.artists ?? [],
    }, []) });
  };

  return (
    <Screen edges={["left", "right"]} scrollable contentContainerStyle={styles.content}>
      <Text style={styles.title}>Calendar</Text>
      <View style={styles.filters}>
        {filters.map((option) => (
          <Pressable key={option.value} onPress={() => setFilter(option.value)} style={[styles.filter, filter === option.value && styles.filterSelected]}
            accessibilityRole="button" accessibilityState={{ selected: filter === option.value }}>
            <Text style={styles.filterText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.monthBar}>
        <Pressable style={styles.nav} onPress={() => setSelected(shiftMonth(selected, -1))} accessibilityRole="button" accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.month}>{monthLabel}</Text>
        <Pressable style={styles.nav} onPress={() => setSelected(shiftMonth(selected, 1))} accessibilityRole="button" accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
        <Pressable style={styles.nav} onPress={() => setSelected(formatCalendarDate(new Date()))} accessibilityRole="button">
          <Text style={styles.filterText}>Today</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {weekdays.map((day, index) => <Text key={index} style={styles.weekday}>{day}</Text>)}
        {grid.map((day, index) => {
          if (!day) return <View key={`empty:${index}`} style={styles.cell} />;
          const dayKinds = [...new Set((byDay.get(day) ?? []).map((item) => item.kind))];
          return (
            <Pressable key={day} style={[styles.cell, selected === day && styles.selectedDay]} onPress={() => setSelected(day)}
              accessibilityRole="button" accessibilityState={{ selected: selected === day }}
              accessibilityLabel={`${day}, ${dayKinds.length ? dayKinds.map((kind) => kinds[kind].label).join(", ") : "no events"}`}>
              <Text style={styles.dayText}>{Number(day.slice(-2))}</Text>
              <View style={styles.dots}>{dayKinds.map((kind) => <View key={kind} style={[styles.dot, { backgroundColor: kinds[kind].color }]} />)}</View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.dayTitle}>{dayLabel}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error || notice ? (
        <Pressable onPress={() => setRetry((value) => value + 1)} accessibilityRole="button" accessibilityLabel="Retry loading calendar">
          <Text style={styles.notice}>{error || notice} Tap to retry.</Text>
        </Pressable>
      ) : null}
      {!loading && !error && !dayItems.length ? (
        <EmptyState title="Nothing on this day" message="Explore events or choose another date." icon="calendar-outline"
          action={<Pressable style={styles.discover} onPress={() => router.push("/(tabs)/events")} accessibilityRole="button"><Text style={styles.discoverText}>Discover events</Text></Pressable>} />
      ) : null}
      {dayItems.map((item) => (
        <View key={item.key} style={styles.card}>
          <Pressable onPress={() => openItem(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
            <View style={styles.kind}><Ionicons name={kinds[item.kind].icon} size={16} color={kinds[item.kind].color} /><Text style={[styles.kindText, { color: kinds[item.kind].color }]}>{kinds[item.kind].label}</Text></View>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.detail}>{[item.time, item.venue].filter(Boolean).join(" · ")}</Text>
            {item.timezoneError ? <Text style={styles.notice}>Event time or time zone unavailable; check its details before logging.</Text> : null}
          </Pressable>
          {item.canLogNight ? <Pressable onPress={() => logNight(item)} style={styles.log} accessibilityRole="button"><Text style={styles.logText}>Went? Log this Night</Text></Pressable> : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: 28, fontWeight: "800", marginBottom: spacing.lg },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filter: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  filterSelected: { backgroundColor: colors.surfaceAlt, borderColor: colors.secondary },
  filterText: { color: colors.text, fontWeight: "600" },
  monthBar: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  month: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center" },
  nav: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, color: colors.muted, textAlign: "center", paddingVertical: spacing.sm, fontSize: 12 },
  cell: { width: `${100 / 7}%`, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  selectedDay: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.secondary },
  dayText: { color: colors.text, fontSize: 15 },
  dots: { flexDirection: "row", gap: 3, minHeight: 7, paddingTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dayTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  kind: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  kindText: { fontWeight: "700", fontSize: 12 },
  itemTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: spacing.xs },
  detail: { color: colors.textSecondary, marginTop: spacing.xs },
  log: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  logText: { color: colors.secondary, fontWeight: "700" },
  notice: { color: colors.warning, marginBottom: spacing.md },
  discover: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: 8 },
  discoverText: { color: colors.background, fontWeight: "700" },
});

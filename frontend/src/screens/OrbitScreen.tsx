import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Animated, PixelRatio, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from "react-native";

import { EmptyState } from "../components/EmptyState";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatCurrency } from "../lib/formatCurrency";
import { goBackOrReplace } from "../lib/navigation";
import { nightsStorage } from "../lib/nightsStorage";
import { showAlert } from "../lib/showAlert";
import { buildShareCardData, buildOrbit, getOrbitYears } from "../lib/orbit";
import { loadOrbitEvents } from "../services/orbitEvents";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Night } from "../types/Night";
import type { EventEntry } from "../types/event";

type Story = { title: string; content: string; detail?: string };

export default function OrbitScreen() {
  const { year: requestedYear } = useLocalSearchParams<{ year?: string }>();
  const [nights, setNights] = useState<Night[]>([]);
  const [year, setYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [eventResult, setEventResult] = useState<{ year: string; nights: Night[]; events: EventEntry[]; notice: boolean } | null>(null);
  const [showFriends, setShowFriends] = useState(false);
  const [showSpending, setShowSpending] = useState(false);
  const [shareAvailable, setShareAvailable] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [page, setPage] = useState(0);
  const { width } = useWindowDimensions();
  const [scrollX] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const years = useMemo(() => getOrbitYears(nights), [nights]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(false);
    nightsStorage.list().then((items) => {
      if (!active) return;
      const available = getOrbitYears(items);
      setNights(items);
      setYear((current) => current && available.includes(current) ? current : requestedYear && available.includes(requestedYear) ? requestedYear : available[0] ?? null);
      setLoading(false);
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [requestedYear, retry]));

  useEffect(() => {
    let active = true;
    if (!year || !buildOrbit(nights, year)) return;
    loadOrbitEvents(nights, year).then((result) => {
      if (!active) return;
      setEventResult({ year, nights, events: result.events, notice: result.failed > 0 || result.limited });
    }).catch(() => { if (active) setEventResult({ year, nights, events: [], notice: true }); });
    return () => { active = false; };
  }, [nights, year]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    import("expo-sharing").then((sharingModule) => sharingModule.isAvailableAsync())
      .then((available) => { if (active) setShareAvailable(available); })
      .catch(() => { if (active) showAlert("Sharing unavailable", "Could not check whether sharing is available."); });
    return () => { active = false; };
  }, []);

  const matchingResult = eventResult?.year === year && eventResult.nights === nights ? eventResult : null;
  const orbit = useMemo(() => year ? buildOrbit(nights, year, matchingResult?.events) : null, [nights, year, matchingResult]);
  const shareData = orbit ? buildShareCardData(orbit, { showFriends, showSpending }) : null;
  const stories: Story[] = orbit ? [
    { title: "YOUR YEAR", content: `${orbit.totalNights} Nights`, detail: `${orbit.distinctArtists} artists · ${orbit.distinctVenues} venues · ${orbit.distinctCities} cities` },
    ...(orbit.topArtists ? [{ title: "YOUR TOP ARTISTS", content: orbit.topArtists.map((item, index) => `${index + 1}. ${item.label} · ${item.value}`).join("\n"), detail: "Counted once per Night" }] : []),
    ...(orbit.topVenues ? [{ title: "YOUR PLACES", content: orbit.topVenues.map((item) => `${item.label} · ${item.value}`).join("\n"), detail: `${orbit.distinctCities} cities explored` }] : []),
    ...(orbit.favouriteStyle ? [{ title: "YOUR FAVOURITE STYLE", content: orbit.favouriteStyle.label, detail: `${orbit.favouriteStyle.value} linked Nights` }] : []),
    ...(orbit.busiestMonth ? [{ title: "YOUR BUSIEST MONTH", content: new Intl.DateTimeFormat(undefined, { month: "long", timeZone: "UTC" }).format(new Date(`${orbit.busiestMonth.label}-01T12:00:00Z`)), detail: `${orbit.busiestMonth.value} Nights` }] : []),
    ...(orbit.longestWeekendStreak ? [{ title: "YOUR WEEKEND STREAK", content: `${orbit.longestWeekendStreak} ${orbit.longestWeekendStreak === 1 ? "weekend" : "weekends"}`, detail: "Consecutive weekends out" }] : []),
    ...(orbit.highestRatedNight ? [{ title: "YOUR HIGHEST-RATED NIGHT", content: orbit.highestRatedNight.eventName, detail: `${orbit.highestRatedNight.rating}/5${orbit.favouriteMoment ? `\n${orbit.favouriteMoment}` : ""}` }] : []),
    ...(orbit.topFriends || orbit.spending ? [{ title: "YOUR NIGHT OUT", content: orbit.topFriends ? orbit.topFriends.map((item) => `${item.label} · ${item.value}`).join("\n") : "Your spending", detail: orbit.spending ? `Recorded spending: ${orbit.spending.map((item) => formatCurrency(item.total, item.currency)).join(" · ")}` : undefined }] : []),
    { title: "FROM FIRST TO LAST", content: orbit.firstNight.eventName, detail: `${orbit.firstNight.date}\n\n${orbit.lastNight.eventName}\n${orbit.lastNight.date}` },
  ] : [];
  const pageCount = stories.length + (shareData ? 1 : 0);

  const selectYear = (selected: string) => {
    setYear(selected);
    setPage(0);
    scrollX.setValue(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  };
  const goToPage = (next: number) => {
    const target = Math.max(0, Math.min(next, pageCount - 1));
    scrollRef.current?.scrollTo({ x: target * width, animated: true });
    setPage(target);
  };
  const share = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const [viewShot, sharingModule] = await Promise.all([import("react-native-view-shot"), import("expo-sharing")]);
      if (!await sharingModule.isAvailableAsync()) throw new Error("Sharing is not available on this device.");
      const uri = await viewShot.captureRef(cardRef, { format: "png", result: "tmpfile", width: 1080 / PixelRatio.get(), height: 1920 / PixelRatio.get() });
      try {
        await sharingModule.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share your Orbit" });
      } finally {
        viewShot.releaseCapture(uri);
      }
    } catch (shareError) {
      showAlert("Could not share Orbit", shareError instanceof Error ? shareError.message : "Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <ScreenHeader title="Your Orbit" onBack={() => goBackOrReplace("/my-raveorb")} />
      {years.length > 1 ? <ScrollView horizontal style={styles.years} contentContainerStyle={styles.yearRail} showsHorizontalScrollIndicator={false}>
        {years.map((item) => <Pressable key={item} onPress={() => selectYear(item)} accessibilityRole="radio" accessibilityState={{ checked: item === year }} style={[styles.year, item === year && styles.selectedYear]}><Text style={styles.yearText}>{item}</Text></Pressable>)}
      </ScrollView> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : error ? (
        <EmptyState title="Orbit unavailable" message="Your Nights could not be loaded." action={<Button title="Retry" onPress={() => setRetry((value) => value + 1)} />} />
      ) : !orbit ? (
        <EmptyState title="Your Orbit is waiting" message="Log at least 3 Nights in a year to unlock your story." action={<Button title="Add a Night" onPress={() => router.push("/night/new")} />} />
      ) : !matchingResult ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : (
        <>
          {matchingResult.notice ? <Text style={styles.notice}>Some linked events could not be checked. Your style may be incomplete.</Text> : null}
          <Animated.ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
            onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
            scrollEventThrottle={16}>
            {stories.map((story, index) => <Animated.View key={story.title} style={{ width, opacity: scrollX.interpolate({ inputRange: [(index - 1) * width, index * width, (index + 1) * width], outputRange: [0.35, 1, 0.35], extrapolate: "clamp" }) }}>
              <ScrollView contentContainerStyle={styles.story} showsVerticalScrollIndicator={false}>
                <Text style={styles.kicker}>{orbit.year} ORBIT · {story.title}</Text>
                <Text style={styles.hero}>{story.content}</Text>
                {story.detail ? <Text style={styles.detail}>{story.detail}</Text> : null}
              </ScrollView>
            </Animated.View>)}
            {shareData ? <ScrollView style={{ width }} contentContainerStyle={styles.sharePage} showsVerticalScrollIndicator={false}>
              <View ref={cardRef} collapsable={false} style={[styles.shareCard, { width: Math.min(width - 48, 260) }]}>
                <Text style={styles.shareKicker}>MY {shareData.year} ORBIT · RAVEORB</Text>
                <Text style={styles.shareHero}>{shareData.totalNights}{"\n"}NIGHTS</Text>
                <Text style={styles.shareNumbers}>{shareData.distinctArtists} ARTISTS · {shareData.distinctVenues} VENUES · {shareData.distinctCities} CITIES</Text>
                {shareData.topArtists ? <Text numberOfLines={3} style={styles.shareText}>TOP ARTISTS{"\n"}{shareData.topArtists.slice(0, 3).map((item) => item.label).join(" · ")}</Text> : null}
                {shareData.favouriteStyle ? <Text numberOfLines={2} style={styles.shareText}>FAVOURITE STYLE{"\n"}{shareData.favouriteStyle.label}</Text> : null}
                {shareData.friends ? <Text numberOfLines={2} style={styles.shareText}>FRIENDS{"\n"}{shareData.friends.map((item) => item.label).join(" · ")}</Text> : null}
                {shareData.spending ? <Text numberOfLines={2} style={styles.shareText}>SPENDING{"\n"}{shareData.spending.map((item) => formatCurrency(item.total, item.currency)).join(" · ")}</Text> : null}
                <Text style={styles.shareFooter}>YOUR SCENE. YOUR HISTORY.</Text>
              </View>
              <View style={styles.toggle}><Text style={styles.toggleText}>Show friends</Text><Switch value={showFriends} onValueChange={setShowFriends} accessibilityLabel="Show friends" /></View>
              <View style={styles.toggle}><Text style={styles.toggleText}>Show spending</Text><Switch value={showSpending} onValueChange={setShowSpending} accessibilityLabel="Show spending" /></View>
              {shareAvailable ? <Button title={sharing ? "Sharing…" : "Share your Orbit"} onPress={share} disabled={sharing} /> : <Text style={styles.notice}>Image sharing is unavailable on this device.</Text>}
            </ScrollView> : null}
          </Animated.ScrollView>
          <View style={styles.navigation}>
            <Button title="Previous" onPress={() => goToPage(page - 1)} disabled={page === 0} />
            <Text style={styles.page}>{page + 1} / {pageCount}</Text>
            <Button title="Next" onPress={() => goToPage(page + 1)} disabled={page >= pageCount - 1} />
          </View>
        </>
      )}
    </Screen>
  );
}

function Button({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  loader: { flex: 1 },
  years: { flexGrow: 0, maxHeight: 55 },
  yearRail: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  year: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: "center", borderRadius: 8, backgroundColor: colors.surface },
  selectedYear: { borderWidth: 1, borderColor: colors.primary },
  yearText: { color: colors.text, fontWeight: "700" },
  story: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  kicker: { color: colors.primary, fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  hero: { color: colors.text, fontSize: 38, fontWeight: "800", marginTop: spacing.lg },
  detail: { color: colors.textSecondary, fontSize: 20, lineHeight: 30, marginTop: spacing.lg },
  notice: { color: colors.textSecondary, fontSize: 12, textAlign: "center", margin: spacing.sm },
  navigation: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  page: { color: colors.textSecondary },
  button: { minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md, backgroundColor: colors.primary, borderRadius: 8 },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.background, fontWeight: "700" },
  sharePage: { alignItems: "center", padding: spacing.md, gap: spacing.sm },
  shareCard: { aspectRatio: 9 / 16, backgroundColor: colors.surfaceAlt, padding: 18, justifyContent: "space-between", borderWidth: 1, borderColor: colors.primary },
  shareKicker: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  shareHero: { color: colors.text, fontSize: 38, fontWeight: "900", lineHeight: 43 },
  shareNumbers: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  shareText: { color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  shareFooter: { color: colors.primary, fontSize: 10, fontWeight: "700" },
  toggle: { width: "100%", maxWidth: 300, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleText: { color: colors.text, fontWeight: "600" },
});

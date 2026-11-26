import { useKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "../components/Screen";
import { eventStatusStorage } from "../lib/eventStatusStorage";
import { formatEventSchedule } from "../lib/eventFormatting";
import { buildPlanMessage, isAfterEvent, nightPrefill } from "../lib/beacon";
import { useBeaconDevOverrides } from "../lib/beaconDevOverrides";
import { beaconStorage, type BeaconDetails } from "../lib/beaconStorage";
import { beaconSetsFromPlan, synchronizeBeaconSets, type FestivalPlan } from "../lib/festivalPlanner";
import { festivalPlannerStorage } from "../lib/festivalPlannerStorage";
import { goBackOrReplace } from "../lib/navigation";
import { showAlert } from "../lib/showAlert";
import { eventsRepository } from "../services/eventsRepository";
import type { EventEntry } from "../types/event";

function Awake() {
  useKeepAwake();
  return null;
}

export default function BeaconScreen() {
  useBeaconDevOverrides();
  const { id } = useLocalSearchParams<{ id: string }>();
  const focused = useIsFocused();
  const [event, setEvent] = useState<EventEntry | null>(null);
  const [details, setDetails] = useState<BeaconDetails>({ sets: [], meetingSpot: "" });
  const detailsRef = useRef(details);
  const revision = useRef(0);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [homeBy, setHomeBy] = useState("");
  const [sharing, setSharing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [festivalPlan, setFestivalPlan] = useState<FestivalPlan | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    if (!id) {
      setLoadError("Event not found.");
      setLoading(false);
    } else {
      Promise.all([eventsRepository.getEvent(id), eventStatusStorage.get(id), beaconStorage.get(id), festivalPlannerStorage.get(id)])
        .then(([loadedEvent, status, saved, plan]) => {
          if (!active) return;
          if (!loadedEvent || status !== "going") {
            setEvent(null);
            setLoadError("Beacon is available for events marked Going.");
            return;
          }
          const fallbackSets = loadedEvent.artists.map((artist) => ({ artist, time: "" }));
          const base = saved ?? { sets: fallbackSets, meetingSpot: "", setsEditedManually: false };
          const initial = synchronizeBeaconSets(base, plan, fallbackSets).details;
          setFestivalPlan(plan);
          detailsRef.current = initial;
          setDetails(initial);
          setSaveError(false);
          setSaving(false);
          setEvent(loadedEvent);
        })
        .catch(() => { if (active) setLoadError("Could not load Beacon details. Please try again."); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; clearInterval(timer); };
    // Retry changes intentionally reload the focused screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retry]));

  const save = (next: BeaconDetails) => {
    detailsRef.current = next;
    setDetails(next);
    const currentRevision = ++revision.current;
    setSaving(true);
    void beaconStorage.set(id, next).then(() => {
      if (revision.current === currentRevision) { setSaveError(false); setSaving(false); }
    }).catch(() => {
      if (revision.current === currentRevision) { setSaveError(true); setSaving(false); }
    });
  };

  const openUrl = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { showAlert("Could not open link", "Please try again."); }
  };

  const sharePlan = async (includeLocation: boolean) => {
    if (!event || sharing) return;
    if (!homeBy.trim()) {
      showAlert("Add a check-in time", "Enter when you plan to be home before sharing.");
      return;
    }
    setSharing(true);
    try {
      let location: { latitude: number; longitude: number } | undefined;
      if (includeLocation) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          showAlert("Location permission needed", "Allow location access or share your plan without it.");
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      }
      await Share.share({ message: buildPlanMessage(event, homeBy, location) });
    } catch {
      showAlert("Could not share plan", "Please try again. No message was sent automatically.");
    } finally {
      setSharing(false);
    }
  };

  const shareHome = async () => {
    try { await Share.share({ message: "Home safe 👍" }); }
    catch { showAlert("Could not open share sheet", "Please try again."); }
  };

  const ticketLink = event?.ticketUrl?.trim() || event?.eventUrl?.trim();

  return (
    <Screen style={styles.screen} scrollable contentContainerStyle={styles.content}>
      {focused && event && !loading && !loadError ? <Awake /> : null}
      <Pressable onPress={() => goBackOrReplace("/(tabs)/events")} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.buttonText}>← Back</Text>
      </Pressable>
      {loading ? <ActivityIndicator color="#fff" /> : loadError || !event ? (
        <View style={styles.section}>
          <Text style={styles.body}>{loadError || "Event not found."}</Text>
          <Button title="Retry" onPress={() => setRetry((value) => value + 1)} />
        </View>
      ) : (
        <>
          <Text style={styles.kicker}>BEACON</Text>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.heading}>{event.venueName || "Venue to be announced"}</Text>
          <Text style={styles.body}>{[event.address, event.city, event.province, event.countryCode].filter(Boolean).join(", ") || "Address unavailable"}</Text>
          <Text style={styles.body}>{formatEventSchedule(event)}</Text>
          <Button title="Open in Maps" onPress={() => {
            const query = encodeURIComponent([event.venueName, event.address, event.city, event.province, event.countryCode].filter(Boolean).join(", "));
            void openUrl(Platform.OS === "ios" ? `https://maps.apple.com/?q=${query}` : `https://www.google.com/maps/search/?api=1&query=${query}`);
          }} />
          {ticketLink ? <Button title="Tickets / event link" onPress={() => { void openUrl(ticketLink); }} /> : null}

          <View style={styles.section}>
            <Text style={styles.heading}>Set times</Text>
            {festivalPlan && synchronizeBeaconSets(details, festivalPlan).canUsePlan ? (
              <Button title="Use my festival plan" onPress={() => save({ ...detailsRef.current, sets: beaconSetsFromPlan(festivalPlan), setsEditedManually: false })} />
            ) : null}
            {details.sets.map((set, index) => (
              <View key={index} style={styles.setRow}>
                <TextInput style={[styles.input, styles.artist]} value={set.artist} placeholder="Artist" placeholderTextColor="#aaa" accessibilityLabel={`Artist ${index + 1}`}
                  onChangeText={(artist) => save({ ...detailsRef.current, setsEditedManually: true, sets: detailsRef.current.sets.map((item, i) => i === index ? { ...item, artist } : item) })} />
                <TextInput style={[styles.input, styles.time]} value={set.time} placeholder="Time" placeholderTextColor="#aaa" accessibilityLabel={`Set time ${index + 1}`}
                  onChangeText={(time) => save({ ...detailsRef.current, setsEditedManually: true, sets: detailsRef.current.sets.map((item, i) => i === index ? { ...item, time } : item) })} />
                <Pressable onPress={() => save({ ...detailsRef.current, setsEditedManually: true, sets: detailsRef.current.sets.filter((_, i) => i !== index) })} accessibilityRole="button" accessibilityLabel={`Remove set ${index + 1}`} style={styles.remove}>
                  <Text style={styles.buttonText}>×</Text>
                </Pressable>
              </View>
            ))}
            <Button title="Add set" onPress={() => save({ ...detailsRef.current, setsEditedManually: true, sets: [...detailsRef.current.sets, { artist: "", time: "" }] })} />
          </View>
          <View style={styles.section}>
            <Text style={styles.heading}>Meeting spot</Text>
            <TextInput style={styles.input} value={details.meetingSpot} maxLength={200} placeholder="Left of the bar" placeholderTextColor="#aaa" accessibilityLabel="Meeting spot"
              onChangeText={(meetingSpot) => save({ ...detailsRef.current, meetingSpot })} />
            {saveError ? <Button title="Could not save details. Tap to retry" onPress={() => save(detailsRef.current)} /> : <Text style={styles.caption}>{saving ? "Saving on this device…" : "Saved on this device."}</Text>}
          </View>
          <View style={styles.section}>
            <Text style={styles.heading}>Safety check-in</Text>
            <Text style={styles.caption}>Choose who to send your message to. Nothing is sent automatically.</Text>
            <TextInput style={styles.input} value={homeBy} onChangeText={setHomeBy} placeholder="Home by (e.g. 3:00 AM)" placeholderTextColor="#aaa" accessibilityLabel="Time you plan to be home" maxLength={80} />
            <Button title="Share my plan" disabled={sharing} onPress={() => { void sharePlan(false); }} />
            <Button title="Share plan with current location" disabled={sharing} onPress={() => { void sharePlan(true); }} />
            <Button title="I'm home" onPress={() => { void shareHome(); }} />
          </View>
          {isAfterEvent(festivalPlan?.days.length ? { ...event, date: festivalPlan.days[festivalPlan.days.length - 1], dateTime: undefined } : event, now) ? (
            <View style={styles.section}>
              <Button title="Log this Night" onPress={() => {
                const starred = festivalPlan ? beaconSetsFromPlan(festivalPlan) : [];
                router.push({ pathname: "/night/new", params: nightPrefill(event, starred.length ? starred : detailsRef.current.sets) });
              }} />
            </View>
          ) : !event.endTime?.trim() ? <Text style={styles.caption}>If no end time is listed, logging becomes available five hours after the start.</Text> : null}
        </>
      )}
    </Screen>
  );
}

function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[styles.button, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button"><Text style={styles.buttonText}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#000" },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  back: { minHeight: 48, justifyContent: "center", alignSelf: "flex-start" },
  kicker: { color: "#bbb", fontSize: 16, fontWeight: "700" },
  title: { color: "#fff", fontSize: 32, fontWeight: "700" },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700" },
  body: { color: "#fff", fontSize: 19, lineHeight: 27 },
  caption: { color: "#ccc", fontSize: 16, lineHeight: 22 },
  section: { gap: 12, marginTop: 20 },
  button: { minHeight: 50, borderWidth: 1, borderColor: "#aaa", borderRadius: 8, justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  input: { minHeight: 50, borderColor: "#aaa", borderWidth: 1, borderRadius: 8, color: "#fff", fontSize: 18, paddingHorizontal: 12 },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  artist: { flex: 1 },
  time: { width: 100 },
  remove: { minWidth: 44, minHeight: 50, justifyContent: "center", alignItems: "center" },
});
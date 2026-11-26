import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { BeaconSpotlight } from "../components/home/BeaconSpotlight";
import { HeroSection } from "../components/home/HeroSection";
import { HomePanelGrid } from "../components/home/HomePanelGrid";
import { Screen } from "../components/Screen";
import { homeContent } from "../constants/homeContent";
import { isBeaconWindow } from "../lib/beacon";
import { useBeaconDevOverrides } from "../lib/beaconDevOverrides";
import { eventStatusStorage } from "../lib/eventStatusStorage";
import { countAlertArtists } from "../lib/artistMatching";
import { listArtistAlerts, refreshArtistAlerts, unseenArtistAlerts } from "../services/artistAlertsService";
import { listTrackedEventChanges, refreshTrackedEvents } from "../services/eventChangesService";
import { eventsRepository } from "../services/eventsRepository";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { EventEntry } from "../types/event";

export default function HomeScreen() {
  useBeaconDevOverrides();
  const [goingEvents, setGoingEvents] = useState<EventEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [alertCount, setAlertCount] = useState(0);
  const [changedCount, setChangedCount] = useState(0);
  const [updatesError, setUpdatesError] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setGoingEvents([]);
    setLoadError(false);
    setUpdatesError(false);
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    refreshTrackedEvents().then(() => listTrackedEventChanges()).then((items) => {
      if (active) setChangedCount(items.filter((item) => item.changes.length > 0).length);
    }).catch(() => { if (active) setUpdatesError(true); });
    refreshArtistAlerts().then(() => listArtistAlerts()).then((alerts) => {
      if (active) setAlertCount(countAlertArtists(unseenArtistAlerts(alerts)));
    }).catch(() => { if (active) setUpdatesError(true); });
    eventStatusStorage.list().then(async (statuses) => {
      const ids = Object.entries(statuses).filter(([, status]) => status === "going").map(([id]) => id);
      const found: EventEntry[] = [];
      let failed = false;
      for (let index = 0; index < ids.length; index += 3) {
        const results = await Promise.allSettled(ids.slice(index, index + 3).map((id) => eventsRepository.getEvent(id)));
        if (!active) return;
        found.push(...results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []));
        failed ||= results.some((result) => result.status === "rejected" || result.value === null);
        setGoingEvents([...found]);
        setLoadError(failed);
      }
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; clearInterval(timer); };
    // Retry intentionally reruns the focused load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]));

  return (
    <Screen edges={["top", "left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <HeroSection alertCount={alertCount} changedCount={changedCount} updatesError={updatesError} />
      <BeaconSpotlight events={goingEvents.filter((event) => isBeaconWindow(event, now))} loadError={loadError} onRetry={() => setRetry((value) => value + 1)} />
      <HomePanelGrid alertCount={alertCount} />
      <Text style={styles.closing}>{homeContent.closing}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.xl },
  closing: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: "center", paddingVertical: spacing.xl },
});

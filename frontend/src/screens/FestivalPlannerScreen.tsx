import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { DateInput } from "../components/DateInput";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { TimePickerField } from "../components/TimePickerField";
import { clashesFor, createFestivalPlan, festivalDays, keepSet, scheduleGaps, sortedSets, timedSet, type FestivalPlan, type PlannedSet, type TimedSet } from "../lib/festivalPlanner";
import { festivalPlannerStorage } from "../lib/festivalPlannerStorage";
import { goBackOrReplace } from "../lib/navigation";
import { showAlert } from "../lib/showAlert";
import { eventsRepository } from "../services/eventsRepository";
import { colors } from "../theme/colors";

type ViewMode = "sets" | "schedule" | "grid";

export default function FestivalPlannerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<FestivalPlan | null>(null);
  const planRef = useRef<FestivalPlan | null>(null);
  const revision = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<ViewMode>("sets");
  const [draft, setDraft] = useState<PlannedSet | null>(null);
  const [day, setDay] = useState("");
  const [newDay, setNewDay] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) throw new Error("Event not found.");
      let existing = await festivalPlannerStorage.get(id);
      if (!existing) {
        const event = await eventsRepository.getEvent(id);
        if (!event) throw new Error("Event not found.");
        existing = createFestivalPlan(event);
        await festivalPlannerStorage.set(existing);
      }
      if (!active) return;
      planRef.current = existing;
      setPlan(existing);
      setDay(existing.days[0]);
      setNewDay(existing.days[existing.days.length - 1]);
      setSaveError(false);
    }
    load().catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load your festival plan.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);

  const save = useCallback((next: FestivalPlan) => {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    planRef.current = updated;
    setPlan(updated);
    const currentRevision = ++revision.current;
    void festivalPlannerStorage.set(updated).then(() => {
      if (revision.current === currentRevision) setSaveError(false);
    }).catch(() => {
      if (revision.current === currentRevision) setSaveError(true);
    });
  }, []);

  const updateDraft = (changes: Partial<PlannedSet>) => setDraft((current) => current ? { ...current, ...changes } : null);
  const saveDraft = () => {
    const current = planRef.current;
    if (!current || !draft) return;
    const artist = draft.artist.trim();
    const enteredStage = draft.stage.trim();
    const stage = current.stages.find((value) => value.toLocaleLowerCase() === enteredStage.toLocaleLowerCase()) ?? enteredStage;
    if (!artist || !stage || !timedSet(draft, current.days)) {
      showAlert("Complete this set", "Choose an artist, stage, day and different start and end times.");
      return;
    }
    const saved = { ...draft, artist, stage };
    const exists = current.sets.some((set) => set.id === saved.id);
    save({ ...current, stages: current.stages.some((value) => value.toLocaleLowerCase() === stage.toLocaleLowerCase()) ? current.stages : [...current.stages, stage],
      sets: exists ? current.sets.map((set) => set.id === saved.id ? saved : set) : [...current.sets, saved] });
    setDraft(null);
  };
  const addDay = () => {
    const current = planRef.current;
    if (!current) return;
    try {
      const days = festivalDays([current.days[0], newDay].sort()[0], [current.days[current.days.length - 1], newDay].sort().pop() ?? "");
      save({ ...current, days });
      setDay(newDay);
    } catch (reason) {
      showAlert("Could not add day", reason instanceof Error ? reason.message : "Choose a valid date.");
    }
  };
  const toggleStar = (set: PlannedSet) => {
    const current = planRef.current;
    if (!current) return;
    if (!set.starred && (!set.artist.trim() || !set.stage.trim() || !timedSet(set, current.days))) {
      setDraft({ ...set, starred: true });
      showAlert("Complete this set", "Add a stage and set times before starring it.");
      return;
    }
    save({ ...current, sets: current.sets.map((item) => item.id === set.id ? { ...item, starred: !item.starred } : item) });
  };

  const selected = plan ? sortedSets(plan, true) : [];
  const gaps = scheduleGaps(selected);
  return (
    <Screen scrollable contentContainerStyle={styles.content}>
      <ScreenHeader onBack={() => goBackOrReplace("/(tabs)/events")} />
      {loading ? <ActivityIndicator color={colors.primary} /> : error || !plan ? (
        <View><Text style={styles.body}>{error || "Festival plan unavailable."}</Text><Button label="Retry" onPress={() => { setError(""); setLoading(true); setRetry((value) => value + 1); }} /></View>
      ) : (
        <>
          <Text style={styles.title}>Plan my day</Text>
          <Text style={styles.body}>{plan.event.title}</Text>
          <Text style={styles.muted}>Saved on this device. Times before 6 AM belong to the night after the selected festival day.</Text>
          {saveError ? <Button label="Could not save. Tap to retry" onPress={() => { if (planRef.current) save(planRef.current); }} /> : null}
          <View style={styles.row}>
            {(["sets", "schedule", "grid"] as const).map((value) => <Button key={value} label={{ sets: "Sets", schedule: "My schedule", grid: "Stage grid" }[value]} onPress={() => { setMode(value); setDraft(null); }} selected={mode === value} />)}
          </View>
          {mode === "sets" ? (
            <>
              <View style={styles.card}>
                <DateInput label="Add festival day" value={newDay} onChange={setNewDay} />
                <Button label="Add day" onPress={addDay} />
              </View>
              {draft ? (
                <View style={styles.card}>
                  <Text style={styles.heading}>Edit set</Text>
                  <TextInput value={draft.artist} onChangeText={(artist) => updateDraft({ artist })} placeholder="Artist" placeholderTextColor={colors.muted} accessibilityLabel="Artist" style={styles.input} />
                  <TextInput value={draft.stage} onChangeText={(stage) => updateDraft({ stage })} placeholder="Stage" placeholderTextColor={colors.muted} accessibilityLabel="Stage" style={styles.input} />
                  {plan.stages.length ? <View style={styles.row}>{plan.stages.map((stage) => <Button key={stage} label={stage} onPress={() => updateDraft({ stage })} selected={draft.stage === stage} />)}</View> : null}
                  <Text style={styles.body}>Festival day</Text>
                  <View style={styles.row}>{plan.days.map((value) => <Button key={value} label={value} onPress={() => updateDraft({ day: value })} selected={draft.day === value} />)}</View>
                  <TimePickerField label="Start time" value={draft.start} onChange={(start) => updateDraft({ start })} />
                  <TimePickerField label="End time" value={draft.end} onChange={(end) => updateDraft({ end })} />
                  <View style={styles.row}><Button label="Save set" onPress={saveDraft} /><Button label="Cancel" onPress={() => setDraft(null)} /></View>
                </View>
              ) : <Button label="Add set" onPress={() => setDraft({ id: `set-${Date.now()}-${Math.random().toString(36).slice(2)}`, artist: "", stage: "", day: day || plan.days[0], start: "", end: "", starred: false })} />}
              {plan.sets.map((set) => (
                <View key={set.id} style={styles.card}>
                  <Text style={styles.heading}>{set.artist || "Untitled set"}</Text>
                  <Text style={styles.muted}>{set.stage && set.start && set.end ? `${set.day} · ${set.stage} · ${set.start}–${set.end}` : "Add stage and times"}</Text>
                  <View style={styles.row}>
                    <Button label={set.starred ? "★ Starred" : "☆ Star"} onPress={() => toggleStar(set)} selected={set.starred} accessibilityLabel={`${set.starred ? "Unstar" : "Star"} ${set.artist}`} />
                    <Button label="Edit" onPress={() => setDraft(set)} accessibilityLabel={`Edit ${set.artist}`} />
                    <Button label="Remove" onPress={() => { const current = planRef.current; if (current) save({ ...current, sets: current.sets.filter((item) => item.id !== set.id) }); }} accessibilityLabel={`Remove ${set.artist}`} />
                  </View>
                </View>
              ))}
            </>
          ) : mode === "schedule" ? (
            selected.length ? selected.map((item) => {
              const clashes = clashesFor(item, selected);
              const gap = gaps.get(item.set.id);
              return <View key={item.set.id}>
                {gap !== undefined && gap >= 15 ? <Text style={styles.gap}>{gap} min free</Text> : null}
                <View style={[styles.card, clashes.length > 0 && styles.clash]} accessible accessibilityLabel={`${item.set.artist}, ${item.set.stage}, ${item.set.day}, ${item.set.start} to ${item.set.end}${clashes.map((other) => `. Clashes with ${other.set.artist} on ${other.set.stage}`).join("")}`}>
                  {clashes.length ? <Text style={styles.clashLabel}>Clash</Text> : null}
                  <Text style={styles.heading}>{item.set.artist}</Text>
                  <Text style={styles.body}>{item.set.day} · {item.set.stage} · {item.set.start}–{item.set.end}</Text>
                </View>
                {clashes.length ? <Button label="Keep this one" accessibilityLabel={`Keep ${item.set.artist}, unstar conflicting sets`} onPress={() => { if (planRef.current) save(keepSet(planRef.current, item.set.id)); }} /> : null}
              </View>;
            }) : <Text style={styles.body}>Star sets to build your schedule.</Text>
          ) : (
            <>
              <View style={styles.row}>{plan.days.map((value) => <Button key={value} label={value} onPress={() => setDay(value)} selected={day === value} />)}</View>
              <StageGrid plan={plan} day={day} />
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function StageGrid({ plan, day }: { plan: FestivalPlan; day: string }) {
  const items = sortedSets(plan).filter((item) => item.set.day === day);
  const stages = [...new Set([...plan.stages, ...items.map((item) => item.set.stage)].filter(Boolean))];
  if (!items.length || !stages.length) return <Text style={styles.body}>Add sets with stages and times to see the grid.</Text>;
  const dayIndex = [...plan.days].sort().indexOf(day);
  const base = dayIndex * 1440;
  const start = Math.floor(Math.min(...items.map((item) => item.start - base)) / 60) * 60;
  const end = Math.ceil(Math.max(...items.map((item) => item.end - base)) / 60) * 60;
  const scale = 1.2;
  const height = (end - start) * scale;
  return <ScrollView horizontal>
    <View style={styles.gridRow}>
      <View style={{ width: 58, height: height + 40 }}>
        <Text style={styles.gridHeader}>Time</Text>
        {Array.from({ length: (end - start) / 60 + 1 }, (_, index) => {
          const hour = (start / 60 + index) % 24;
          return <Text key={index} style={[styles.axis, { top: 40 + index * 60 * scale }]}>{String(hour).padStart(2, "0")}:00</Text>;
        })}
      </View>
      {stages.map((stage) => {
        const stageItems = items.filter((item) => item.set.stage === stage);
        const lanes: number[] = [];
        const positioned = stageItems.map((item) => {
          let lane = lanes.findIndex((laneEnd) => laneEnd <= item.start);
          if (lane < 0) lane = lanes.length;
          lanes[lane] = item.end;
          return { item, lane };
        });
        const width = Math.max(150, lanes.length * 120);
        return <View key={stage} style={{ width, height: height + 40 }}>
          <Text style={styles.gridHeader}>{stage}</Text>
          <View style={[styles.gridColumn, { height }]}>
            {positioned.map(({ item, lane }: { item: TimedSet; lane: number }) => <View key={item.set.id} style={[styles.gridSet, { top: (item.start - base - start) * scale, height: (item.end - item.start) * scale, left: lane * width / lanes.length, width: width / lanes.length }]}>
              <Text style={styles.gridText}>{item.set.starred ? "★ " : ""}{item.set.artist}</Text>
              <Text style={styles.gridText}>{item.set.start}–{item.set.end}</Text>
            </View>)}
          </View>
        </View>;
      })}
    </View>
  </ScrollView>;
}

function Button({ label, onPress, selected = false, accessibilityLabel }: { label: string; onPress: () => void; selected?: boolean; accessibilityLabel?: string }) {
  return <Pressable onPress={onPress} style={[styles.button, selected && styles.selected]} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected }}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  heading: { color: colors.text, fontSize: 18, fontWeight: "700" },
  body: { color: colors.text, fontSize: 15 },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  buttonText: { color: colors.text, fontWeight: "600" },
  card: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, gap: 8, marginBottom: 8 },
  input: { color: colors.text, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12 },
  clash: { backgroundColor: "#4b1822", borderColor: "#ff8080", borderWidth: 2 },
  clashLabel: { color: "#ffb5b5", fontWeight: "700", fontSize: 16 },
  gap: { color: colors.secondary, paddingVertical: 8 },
  gridRow: { flexDirection: "row" },
  gridHeader: { color: colors.text, height: 40, fontWeight: "700", padding: 4 },
  axis: { position: "absolute", left: 0, color: colors.textSecondary, fontSize: 12 },
  gridColumn: { borderLeftWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  gridSet: { position: "absolute", backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.primary, padding: 4, overflow: "hidden" },
  gridText: { color: colors.text, fontSize: 12 },
});

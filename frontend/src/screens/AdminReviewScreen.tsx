import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import {
  approveSubmission,
  deleteSubmission,
  listSubmissions,
  rejectSubmission,
} from "../services/submissionsApi";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { EventSubmission, SubmissionStatus } from "../types/event";

const statuses: SubmissionStatus[] = ["pending", "approved", "rejected"];

export default function AdminReviewScreen() {
  const [code, setCode] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [status, setStatus] = useState<SubmissionStatus>("pending");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => () => {
    setCode("");
    setAdminToken("");
    setSubmissions([]);
    setReason("");
    setError("");
  }, []));

  const load = async (token: string, nextStatus: SubmissionStatus) => {
    setLoading(true);
    setError("");
    try {
      setSubmissions(await listSubmissions(token, nextStatus));
      setStatus(nextStatus);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load submissions.");
    } finally {
      setLoading(false);
    }
  };

  const unlock = () => {
    const entered = code.trim();
    if (!entered) {
      setError("Enter the admin code.");
      return;
    }
    setAdminToken(entered);
    setCode("");
    void load(entered, status);
  };

  const review = async (submission: EventSubmission, action: "approve" | "reject" | "delete") => {
    if (!adminToken) return;
    setWorkingId(submission.id);
    setError("");
    try {
      if (action === "approve") await approveSubmission(adminToken, submission.id);
      if (action === "reject") await rejectSubmission(adminToken, submission.id, reason);
      if (action === "delete") await deleteSubmission(adminToken, submission.id);
      await load(adminToken, status);
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this submission.");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <Screen edges={["top", "left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader title="Event review" onBack={() => router.back()} />
      {!adminToken ? (
        <View style={styles.unlock}>
          <Text style={styles.intro}>Enter the admin code to review community event submissions.</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Admin code"
            placeholderTextColor={colors.muted}
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Admin code"
          />
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          <Pressable onPress={unlock} disabled={loading} style={styles.primaryButton} accessibilityRole="button">
            {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryText}>Unlock review</Text>}
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.statusRail}>
            {statuses.map((item) => (
              <Pressable key={item} onPress={() => { void load(adminToken, item); }} style={[styles.statusButton, status === item && styles.statusSelected]} accessibilityRole="tab" accessibilityState={{ selected: status === item }}>
                <Text style={[styles.statusText, status === item && styles.statusTextSelected]}>{item}</Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : submissions.length ? submissions.map((submission) => (
            <View key={submission.id} style={styles.card}>
              <Text style={styles.cardTitle}>{submission.title}</Text>
              <Text style={styles.detail}>{submission.date} · {submission.startTime}–{submission.endTime} · {submission.timezone}</Text>
              <Text style={styles.detail}>{submission.venueName} · {submission.city}, {submission.countryCode}</Text>
              <Text style={styles.detail}>Style: {submission.style}{submission.artists.length ? ` · ${submission.artists.join(", ")}` : ""}</Text>
              <Text style={styles.description}>{submission.description}</Text>
              {submission.submitterEmail ? <Text style={styles.email}>Submitter: {submission.submitterEmail}</Text> : null}
              {submission.ticketUrl ? <Text style={styles.detail}>{submission.ticketUrl}</Text> : null}
              {status === "pending" ? (
                <>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Optional rejection reason"
                    placeholderTextColor={colors.muted}
                    style={styles.reasonInput}
                    maxLength={500}
                    accessibilityLabel={`Rejection reason for ${submission.title}`}
                  />
                  <View style={styles.actionRow}>
                    <Action label="Approve" icon="checkmark" disabled={workingId === submission.id} onPress={() => { void review(submission, "approve"); }} />
                    <Action label="Reject" icon="close" disabled={workingId === submission.id} destructive onPress={() => { void review(submission, "reject"); }} />
                    <Action label="Delete" icon="trash-outline" disabled={workingId === submission.id} destructive onPress={() => { void review(submission, "delete"); }} />
                  </View>
                </>
              ) : null}
            </View>
          )) : (
            <Text style={styles.empty}>{loading ? "" : `No ${status} submissions.`}</Text>
          )}
          <Pressable onPress={() => { setAdminToken(""); setCode(""); setSubmissions([]); setError(""); }} style={styles.lockButton} accessibilityRole="button">
            <Text style={styles.lockText}>Lock review</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function Action({
  label,
  icon,
  onPress,
  disabled,
  destructive = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.action, destructive && styles.destructiveAction, disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={16} color={destructive ? colors.error : colors.success} />
      <Text style={[styles.actionText, destructive && styles.destructiveText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
  unlock: { gap: spacing.md, marginTop: spacing.md },
  intro: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  input: { minHeight: 48, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.md, fontSize: 14 },
  primaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.primary },
  primaryText: { color: colors.background, fontSize: 14, fontWeight: "700" },
  statusRail: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.lg },
  statusButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statusSelected: { borderColor: colors.primary, backgroundColor: "rgba(212, 175, 55, 0.12)" },
  statusText: { color: colors.textSecondary, fontSize: 12, textTransform: "capitalize" },
  statusTextSelected: { color: colors.accent, fontWeight: "700" },
  loader: { marginVertical: spacing.xl },
  card: { padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: spacing.xs },
  detail: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: spacing.xs },
  description: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  email: { color: colors.secondary, fontSize: 12, marginTop: spacing.sm },
  reasonInput: { minHeight: 42, color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm, marginTop: spacing.md },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  action: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.success, borderRadius: 8 },
  destructiveAction: { borderColor: "rgba(232, 120, 120, 0.45)" },
  actionText: { color: colors.success, fontSize: 11, fontWeight: "700" },
  destructiveText: { color: colors.error },
  disabled: { opacity: 0.5 },
  empty: { color: colors.muted, fontSize: 13, marginVertical: spacing.xl },
  error: { color: colors.error, fontSize: 13, lineHeight: 19 },
  lockButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  lockText: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
});

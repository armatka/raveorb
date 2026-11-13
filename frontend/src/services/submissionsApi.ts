import type {
  EventSubmission,
  EventSubmissionInput,
  SubmissionStatus,
} from "../types/event";
import { hasEventsApi, requestEventsApi } from "./eventsApi";

function assertApiConfigured(): void {
  if (!hasEventsApi()) throw new Error("Event submissions need a configured API URL.");
}

function adminHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function submitEvent(input: EventSubmissionInput): Promise<{ id: string; status: "pending" }> {
  assertApiConfigured();
  const { payload } = await requestEventsApi("/api/submissions", { method: "POST", body: input });
  if (typeof payload !== "object" || payload === null
    || typeof (payload as Record<string, unknown>).id !== "string"
    || (payload as Record<string, unknown>).status !== "pending") {
    throw new Error("The event service returned an invalid submission response.");
  }
  return payload as { id: string; status: "pending" };
}

export async function listSubmissions(token: string, status: SubmissionStatus = "pending"): Promise<EventSubmission[]> {
  assertApiConfigured();
  const { payload } = await requestEventsApi(`/api/admin/submissions?${new URLSearchParams({ status })}`, {
    headers: adminHeaders(token),
  });
  if (!Array.isArray(payload)) throw new Error("The event service returned an invalid review list.");
  return payload as EventSubmission[];
}

export async function approveSubmission(token: string, id: string): Promise<EventSubmission> {
  return updateSubmission(token, id, "approve");
}

export async function rejectSubmission(token: string, id: string, reason?: string): Promise<EventSubmission> {
  return updateSubmission(token, id, "reject", reason);
}

async function updateSubmission(
  token: string,
  id: string,
  action: "approve" | "reject",
  reason?: string,
): Promise<EventSubmission> {
  assertApiConfigured();
  const { payload } = await requestEventsApi(`/api/admin/submissions/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: adminHeaders(token),
    ...(action === "reject" ? { body: { ...(reason?.trim() ? { reason: reason.trim() } : {}) } } : {}),
  });
  if (typeof payload !== "object" || payload === null
    || typeof (payload as Record<string, unknown>).id !== "string") {
    throw new Error("The event service returned an invalid review response.");
  }
  return payload as EventSubmission;
}

export async function deleteSubmission(token: string, id: string): Promise<void> {
  assertApiConfigured();
  await requestEventsApi(`/api/admin/submissions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  });
}

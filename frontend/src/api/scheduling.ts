import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./core/client";

export type Appointment = Schemas["AppointmentOut"];

/** Same limit as the backend: a short message, not a file. */
export const NOTE_MAX_LENGTH = 280;

/** Every appointment query lives under this key, so a change refreshes them all. */
export const APPOINTMENTS = ["appointments"] as const;

/** A patient's own appointments, or a practitioner's or coordinator's schedule. */
export function useMyAppointments(range?: { start: string; end: string }, refreshEveryMs?: number) {
  return useQuery({
    queryKey: [...APPOINTMENTS, "mine", range],
    queryFn: () => unwrap(api.GET("/api/v1/scheduling/appointments/mine", { params: { query: range } })),
    refetchInterval: refreshEveryMs,
  });
}

export function usePatientAppointments(patientId: string) {
  return useQuery({
    queryKey: [...APPOINTMENTS, "patient", patientId],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/scheduling/patients/{patient_id}/appointments", {
          params: { path: { patient_id: patientId } },
        }),
      ),
  });
}

export function useBookAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["AppointmentCreate"]) => unwrap(api.POST("/api/v1/scheduling/appointments", { body })),
    // Refreshed whatever the outcome: a refusal usually means someone else changed it first.
    onSettled: () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS }),
  });
}

export type CancelReason = Schemas["CancelReason"];

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, reason }: { appointmentId: string; reason: CancelReason }) =>
      unwrap(
        api.POST("/api/v1/scheduling/appointments/{appointment_id}/cancel", {
          params: { path: { appointment_id: appointmentId } },
          body: { reason },
        }),
      ),
    // Refreshed whatever the outcome: a refusal usually means someone else changed it first.
    onSettled: () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS }),
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, ...body }: { appointmentId: string } & Schemas["AppointmentReschedule"]) =>
      unwrap(
        api.POST("/api/v1/scheduling/appointments/{appointment_id}/reschedule", {
          params: { path: { appointment_id: appointmentId } },
          body,
        }),
      ),
    // Refreshed whatever the outcome: a refusal usually means someone else changed it first.
    onSettled: () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS }),
  });
}

/** Writes or clears the staff note on an appointment ("will be 10 minutes late"). */
export function useUpdateAppointmentNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, note }: { appointmentId: string; note: string }) =>
      unwrap(
        api.PATCH("/api/v1/scheduling/appointments/{appointment_id}", {
          params: { path: { appointment_id: appointmentId } },
          body: { note },
        }),
      ),
    // Refreshed whatever the outcome: a refusal usually means someone else changed it first.
    onSettled: () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS }),
  });
}

/** A practitioner's taken and free times on one day. Off until both are chosen. */
/** Who the free times are for: the patient's other bookings count as taken, and the
 * appointment being moved (`ignoreId`) doesn't. */
export type AvailabilityFor = { patientId?: string; ignoreId?: string };

export function useAvailability(
  professionalId: string,
  day: string,
  minutes: number,
  { patientId, ignoreId }: AvailabilityFor = {},
) {
  return useQuery({
    queryKey: [...APPOINTMENTS, "availability", professionalId, day, minutes, patientId, ignoreId],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/scheduling/professionals/{professional_id}/availability", {
          params: {
            path: { professional_id: professionalId },
            query: { day, minutes, patient_id: patientId, ignore_id: ignoreId },
          },
        }),
      ),
    enabled: Boolean(professionalId && day),
  });
}

export type PlanningSlot = Schemas["PlanningSlot"];

/** Several practitioners' appointments over the week starting on `monday`. */
export function useWeekPlanning(monday: string, professionalIds: string[]) {
  return useQuery({
    queryKey: [...APPOINTMENTS, "planning", monday, [...professionalIds].sort()],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/scheduling/planning", {
          params: { query: { monday, professional_ids: professionalIds } },
        }),
      ),
    enabled: professionalIds.length > 0,
  });
}

export type GroupSession = Schemas["GroupSessionOut"];
export type GroupSessionDetail = Schemas["GroupSessionDetail"];
const GROUPS = [...APPOINTMENTS, "groups"] as const;

/** Upcoming group sessions with how full they are (all for reception and coordinators). */
export function useGroupSessions() {
  return useQuery({ queryKey: GROUPS, queryFn: () => unwrap(api.GET("/api/v1/scheduling/group-sessions")) });
}

export function useMyGroupSessions() {
  return useQuery({
    queryKey: [...GROUPS, "mine"],
    queryFn: () => unwrap(api.GET("/api/v1/scheduling/group-sessions/mine")),
  });
}

export function useGroupSession(sessionId: string) {
  return useQuery({
    queryKey: [...GROUPS, sessionId],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/scheduling/group-sessions/{session_id}", { params: { path: { session_id: sessionId } } }),
      ),
  });
}

function useGroupMutation<T>(run: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: run, onSettled: () => queryClient.invalidateQueries({ queryKey: GROUPS }) });
}

export function useCreateGroupSession() {
  return useGroupMutation((body: Schemas["GroupSessionCreate"]) =>
    unwrap(api.POST("/api/v1/scheduling/group-sessions", { body })),
  );
}

export function useEnroll(sessionId: string) {
  return useGroupMutation((patientId: string) =>
    unwrap(
      api.POST("/api/v1/scheduling/group-sessions/{session_id}/enrollments", {
        params: { path: { session_id: sessionId } },
        body: { patient_id: patientId },
      }),
    ),
  );
}

export function useUnenroll(sessionId: string) {
  return useGroupMutation((patientId: string) =>
    unwrap(
      api.DELETE("/api/v1/scheduling/group-sessions/{session_id}/enrollments/{patient_id}", {
        params: { path: { session_id: sessionId, patient_id: patientId } },
      }),
    ),
  );
}

export function useRecordAttendance(sessionId: string) {
  return useGroupMutation(({ patientId, status }: { patientId: string; status: Schemas["EnrollmentStatus"] }) =>
    unwrap(
      api.POST("/api/v1/scheduling/group-sessions/{session_id}/enrollments/{patient_id}/attendance", {
        params: { path: { session_id: sessionId, patient_id: patientId } },
        body: { status },
      }),
    ),
  );
}

export function useCancelGroupSession(sessionId: string) {
  return useGroupMutation(() =>
    unwrap(
      api.POST("/api/v1/scheduling/group-sessions/{session_id}/cancel", {
        params: { path: { session_id: sessionId } },
      }),
    ),
  );
}

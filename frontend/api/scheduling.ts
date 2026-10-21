import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type Appointment = Schemas["AppointmentOut"];

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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: APPOINTMENTS }),
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      unwrap(
        api.POST("/api/v1/scheduling/appointments/{appointment_id}/cancel", {
          params: { path: { appointment_id: appointmentId } },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: APPOINTMENTS }),
  });
}

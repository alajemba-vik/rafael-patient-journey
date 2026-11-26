import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./core/client";

export type Questionnaire = Schemas["Questionnaire"];
export type Session = Schemas["SessionOut"];

const QUESTIONNAIRES = ["questionnaires"] as const;

export function useDueQuestionnaires() {
  return useQuery({
    queryKey: [...QUESTIONNAIRES, "due"],
    queryFn: () => unwrap(api.GET("/api/v1/questionnaires/due")),
  });
}

export function useMyScores() {
  return useQuery({
    queryKey: [...QUESTIONNAIRES, "scores", "mine"],
    queryFn: () => unwrap(api.GET("/api/v1/questionnaires/scores/mine")),
  });
}

export function useSubmitQuestionnaire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instrument,
      answers,
    }: {
      instrument: Questionnaire["instrument"];
      answers: Record<string, number>;
    }) =>
      unwrap(
        api.POST("/api/v1/questionnaires/{instrument}/responses", {
          params: { path: { instrument } },
          body: { answers },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: QUESTIONNAIRES }),
  });
}

/** A patient's quality-of-life scores, for their care team. */
export function usePatientScores(patientId: string, enabled = true) {
  return useQuery({
    queryKey: [...QUESTIONNAIRES, "scores", patientId],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/questionnaires/patients/{patient_id}/scores", {
          params: { path: { patient_id: patientId } },
        }),
      ),
    enabled,
  });
}

const SESSIONS = [...QUESTIONNAIRES, "sessions"] as const;

/** The patient's recent finished sessions still waiting for their rating. */
export function useSessionsToRate() {
  return useQuery({
    queryKey: [...SESSIONS, "to-rate"],
    queryFn: () => unwrap(api.GET("/api/v1/questionnaires/sessions/to-rate")),
  });
}

export function useRateSessionAsPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, ...body }: { appointmentId: string; difficulty: number; satisfaction: number }) =>
      unwrap(
        api.POST("/api/v1/questionnaires/sessions/{appointment_id}/patient-rating", {
          params: { path: { appointment_id: appointmentId } },
          body,
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SESSIONS }),
  });
}

/** Every finished session of a patient with both sides' ratings, for their care team. */
export function usePatientSessions(patientId: string) {
  return useQuery({
    queryKey: [...SESSIONS, "patient", patientId],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/questionnaires/patients/{patient_id}/sessions", {
          params: { path: { patient_id: patientId } },
        }),
      ),
  });
}

export function useRateSessionAsPractitioner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appointmentId,
      ...body
    }: {
      appointmentId: string;
      coping: number;
      intensity_mets: number | null;
    }) =>
      unwrap(
        api.POST("/api/v1/questionnaires/sessions/{appointment_id}/practitioner-rating", {
          params: { path: { appointment_id: appointmentId } },
          body,
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SESSIONS }),
  });
}

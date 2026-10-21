import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type Questionnaire = Schemas["Questionnaire"];
export type Score = Schemas["ScoreOut"];

export const QUESTIONNAIRES = ["questionnaires"] as const;

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
    mutationFn: ({ instrument, answers }: { instrument: Questionnaire["instrument"]; answers: Record<string, number> }) =>
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

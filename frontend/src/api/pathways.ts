import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./core/client";

export type Pathway = Schemas["PathwayOut"];
export type Message = Schemas["MessageOut"];

const PATHWAYS = ["pathways"] as const;

/** The patient's own pathways, newest first. */
export function useMyPathways() {
  return useQuery({
    queryKey: [...PATHWAYS, "mine"],
    queryFn: () => unwrap(api.GET("/api/v1/pathways/mine")),
  });
}

/** A patient's pathways as their care team sees them, notes included. */
export function usePatientPathways(patientId: string, enabled = true) {
  return useQuery({
    queryKey: [...PATHWAYS, "patient", patientId],
    queryFn: () =>
      unwrap(api.GET("/api/v1/pathways/patients/{patient_id}", { params: { path: { patient_id: patientId } } })),
    enabled,
  });
}

export function useRaiseNeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pathwayId, note }: { pathwayId: string; note: string }) =>
      unwrap(
        api.POST("/api/v1/pathways/{pathway_id}/needs", {
          params: { path: { pathway_id: pathwayId } },
          body: { note },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PATHWAYS }),
  });
}

export type MilestoneCreate = Schemas["MilestoneCreate"];

function useRefreshPathways() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: PATHWAYS });
}

export function useOpenPathway() {
  const onSuccess = useRefreshPathways();
  return useMutation({
    mutationFn: (patientId: string) => unwrap(api.POST("/api/v1/pathways", { body: { patient_id: patientId } })),
    onSuccess,
  });
}

export function useRecordMilestone() {
  const onSuccess = useRefreshPathways();
  return useMutation({
    mutationFn: ({ pathwayId, body }: { pathwayId: string; body: MilestoneCreate }) =>
      unwrap(
        api.POST("/api/v1/pathways/{pathway_id}/milestones", { params: { path: { pathway_id: pathwayId } }, body }),
      ),
    onSuccess,
  });
}

export function useClosePathway() {
  const onSuccess = useRefreshPathways();
  return useMutation({
    mutationFn: (pathwayId: string) =>
      unwrap(api.POST("/api/v1/pathways/{pathway_id}/close", { params: { path: { pathway_id: pathwayId } } })),
    onSuccess,
  });
}

/** The open pathways a coordinator leads, with the next milestone due. */
export function useLedPathways() {
  return useQuery({ queryKey: [...PATHWAYS, "led"], queryFn: () => unwrap(api.GET("/api/v1/pathways/led")) });
}

/** The coordinator's inbox of flagged needs. */
export function useOpenNeeds() {
  return useQuery({ queryKey: [...PATHWAYS, "needs"], queryFn: () => unwrap(api.GET("/api/v1/pathways/needs")) });
}

export function useResolveNeed() {
  const onSuccess = useRefreshPathways();
  return useMutation({
    mutationFn: (needId: string) =>
      unwrap(api.POST("/api/v1/pathways/needs/{need_id}/resolve", { params: { path: { need_id: needId } } })),
    onSuccess,
  });
}

const MESSAGES = ["messages"] as const;
// Answers can come in while the conversation is open.
const MESSAGES_REFRESH_MS = 30_000;

/** A patient's conversation with their care team, oldest first. `patientId` null = my own. */
export function useMessages(patientId: string | null) {
  return useQuery({
    queryKey: [...MESSAGES, patientId ?? "mine"],
    queryFn: () =>
      patientId
        ? unwrap(
            api.GET("/api/v1/pathways/patients/{patient_id}/messages", { params: { path: { patient_id: patientId } } }),
          )
        : unwrap(api.GET("/api/v1/pathways/messages/mine")),
    refetchInterval: MESSAGES_REFRESH_MS,
  });
}

export function useSendMessage(patientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      patientId
        ? unwrap(
            api.POST("/api/v1/pathways/patients/{patient_id}/messages", {
              params: { path: { patient_id: patientId } },
              body: { body },
            }),
          )
        : unwrap(api.POST("/api/v1/pathways/messages/mine", { body: { body } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...MESSAGES, patientId ?? "mine"] }),
  });
}

export type Assessment = Schemas["AssessmentOut"];
const ASSESSMENTS = ["assessments"] as const;

/** The scored tests of the patient's current or latest pathway, for their care team. */
export function usePatientAssessments(patientId: string) {
  return useQuery({
    queryKey: [...ASSESSMENTS, patientId],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/pathways/patients/{patient_id}/assessments", { params: { path: { patient_id: patientId } } }),
      ),
  });
}

export function useRecordAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pathwayId, body }: { pathwayId: string; body: Schemas["AssessmentRecord"] }) =>
      unwrap(
        api.POST("/api/v1/pathways/{pathway_id}/assessments", { params: { path: { pathway_id: pathwayId } }, body }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ASSESSMENTS }),
  });
}

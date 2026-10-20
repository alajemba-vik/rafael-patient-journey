import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type PatientPathway = Schemas["PatientPathway"];
export type Pathway = Schemas["PathwayOut"];

export const PATHWAYS = ["pathways"] as const;

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

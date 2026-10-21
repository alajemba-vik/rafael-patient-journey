import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { PATIENTS } from "./patients";

const CARE_TEAM = ["care-team"] as const;

export function useCareTeam(patientId: string, enabled = true) {
  return useQuery({
    queryKey: [...CARE_TEAM, patientId],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/care-team/patients/{patient_id}/members", {
          params: { path: { patient_id: patientId } },
        }),
      ),
    enabled,
  });
}

/** Practitioners and coordinators to choose from. Rarely changes, so cached longer. */
export function useCareStaff() {
  return useQuery({
    queryKey: ["care-staff"],
    queryFn: () => unwrap(api.GET("/api/v1/auth/care-staff")),
    staleTime: 10 * 60_000,
  });
}

/** Adding or removing someone changes what the patient file shows: refresh both. */
function useRefreshAfterTeamChange() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: CARE_TEAM });
    void queryClient.invalidateQueries({ queryKey: PATIENTS });
  };
}

export function useAddToCareTeam() {
  const refresh = useRefreshAfterTeamChange();
  return useMutation({
    mutationFn: (body: Schemas["AssignmentCreate"]) => unwrap(api.POST("/api/v1/care-team/assignments", { body })),
    onSuccess: refresh,
  });
}

export function useRemoveFromCareTeam() {
  const refresh = useRefreshAfterTeamChange();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      unwrap(
        api.DELETE("/api/v1/care-team/assignments/{assignment_id}", {
          params: { path: { assignment_id: assignmentId } },
        }),
      ),
    onSuccess: refresh,
  });
}

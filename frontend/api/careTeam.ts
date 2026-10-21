import { useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type CareTeamMember = Schemas["CareTeamMember"];

export const CARE_TEAM = ["care-team"] as const;

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

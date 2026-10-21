import { useQuery } from "@tanstack/react-query";

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

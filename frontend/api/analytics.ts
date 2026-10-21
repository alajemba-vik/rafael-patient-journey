import { useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type Dashboard = Schemas["Dashboard"];

export function useDashboard() {
  return useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => unwrap(api.GET("/api/v1/analytics/dashboard")),
    // Aggregates move slowly: no need to refetch more than every few minutes.
    staleTime: 5 * 60_000,
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { APPOINTMENTS } from "./scheduling";

export type BoardStatus = Schemas["AppointmentStatus"];

// Arrivals happen all day: keep the board fresh without anyone pressing reload.
const REFRESH_MS = 30_000;

/** A day's appointments, cancelled ones included. Refreshed on its own: arrivals happen all day. */
export function useDayBoard(day: string) {
  return useQuery({
    queryKey: [...APPOINTMENTS, "day", day],
    queryFn: () => unwrap(api.GET("/api/v1/reception/day", { params: { query: { day } } })),
    refetchInterval: REFRESH_MS,
  });
}

export function useChangeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, status }: { appointmentId: string; status: BoardStatus }) =>
      unwrap(
        api.POST("/api/v1/reception/appointments/{appointment_id}/status", {
          params: { path: { appointment_id: appointmentId } },
          body: { status },
        }),
      ),
    // Refreshed whatever the outcome: a refusal usually means someone else changed it first.
    onSettled: () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS }),
  });
}

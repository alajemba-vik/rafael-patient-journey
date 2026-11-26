import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./core/client";

export type Notification = Schemas["NotificationOut"];

const NOTIFICATIONS = ["notifications"] as const;
// New notifications arrive while someone works: check now and then without a reload.
const REFRESH_MS = 60_000;

/** The signed-in user's own inbox, newest first, with how many are unread. */
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: NOTIFICATIONS,
    queryFn: () => unwrap(api.GET("/api/v1/notifications")),
    refetchInterval: REFRESH_MS,
    enabled,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      unwrap(
        api.POST("/api/v1/notifications/{notification_id}/read", {
          params: { path: { notification_id: notificationId } },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/notifications/read")),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS }),
  });
}

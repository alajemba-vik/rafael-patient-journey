import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import { session } from "./session";

/** Log in, keep the token for this tab, and forget any previous person's data. */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      unwrap(api.POST("/api/v1/auth/login", { body: credentials })),
    onSuccess: ({ access_token }) => {
      session.start(access_token);
      queryClient.removeQueries({ queryKey: ["me"] });
    },
  });
}

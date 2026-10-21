import { useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { session } from "./session";

export type Me = Schemas["UserOut"];
export type Role = Me["role"];

/** The logged-in account. Fetched once per session: it only changes when someone logs in. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => unwrap(api.GET("/api/v1/auth/me")),
    enabled: session.getToken() !== null,
    staleTime: Infinity,
  });
}

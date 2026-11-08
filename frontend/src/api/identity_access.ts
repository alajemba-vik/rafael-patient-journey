// identity_access: logging in, who is logged in, staff accounts, and which buttons a role sees.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./core/client";
import { session } from "./core/session";
import { PATIENTS } from "./patients";

type Me = Schemas["UserOut"];
export type Role = Me["role"];
export type AccountCreate = Schemas["UserCreate"];

// Session

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

/** The logged-in account. Fetched once per session: it only changes when someone logs in. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => unwrap(api.GET("/api/v1/auth/me")),
    enabled: session.getToken() !== null,
    staleTime: Infinity,
  });
}

// Permissions shown in the screens

// Which actions each role sees in the screens. The API decides and enforces every permission;
// this only chooses which buttons to show, and keeps that choice in one place so screens don't
// drift apart. Keep it in step with the services' access policies.
type Action = "bookAppointments" | "manageCareTeam" | "leadPathways" | "takeOnPatients";

const ACTIONS: Record<Action, Role[]> = {
  bookAppointments: ["coordinator", "secretary"],
  manageCareTeam: ["coordinator"],
  leadPathways: ["coordinator"],
  takeOnPatients: ["coordinator"],
};

/** `can.bookAppointments` and so on, for the logged-in person. */
export function usePermissions(): Record<Action, boolean> {
  const role = useMe().data?.role;
  return Object.fromEntries(
    Object.entries(ACTIONS).map(([action, roles]) => [action, role !== undefined && roles.includes(role)]),
  ) as Record<Action, boolean>;
}

// Staff accounts (admin)

const ACCOUNTS = ["accounts"] as const;

export function useAccounts() {
  return useQuery({ queryKey: ACCOUNTS, queryFn: () => unwrap(api.GET("/api/v1/auth/users")) });
}

/** Create a login; for a patient, then link it to their record so they see their portal. */
export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ account, patientId }: { account: AccountCreate; patientId?: string }) => {
      const created = await unwrap(api.POST("/api/v1/auth/users", { body: account }));
      if (patientId) {
        await unwrap(
          api.PATCH("/api/v1/patients/{patient_id}", {
            params: { path: { patient_id: patientId } },
            body: { user_id: created.id },
          }),
        );
      }
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACCOUNTS });
      void queryClient.invalidateQueries({ queryKey: PATIENTS });
      void queryClient.invalidateQueries({ queryKey: ["care-staff"] });
    },
  });
}

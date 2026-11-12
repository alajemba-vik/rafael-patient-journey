// identity_access: logging in, who is logged in, staff accounts, and which buttons a role sees.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./core/client";
import { session } from "./core/session";
import { PATIENTS } from "./patients";

type Me = Schemas["UserOut"];
export type Role = Me["role"];
export type Account = Me;
export type AccountCreate = Schemas["UserCreate"];
export type AccountUpdate = Schemas["UserUpdate"];
export type AuditEvent = Schemas["AuditEventOut"];

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
type Action = "bookAppointments" | "manageOwnSessions" | "manageCareTeam" | "leadPathways" | "takeOnPatients";

const ACTIONS: Record<Action, Role[]> = {
  // Book, move and cancel for anyone in the patient's care team.
  bookAppointments: ["coordinator", "secretary"],
  // A practitioner books follow-ups with themselves and manages their own sessions.
  manageOwnSessions: ["professional"],
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

/** Change an account's role or name, or deactivate and reactivate its login. */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AccountUpdate }) =>
      unwrap(api.PATCH("/api/v1/auth/users/{user_id}", { params: { path: { user_id: id } }, body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACCOUNTS });
      void queryClient.invalidateQueries({ queryKey: ["care-staff"] });
    },
  });
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

// Audit trail (admin)

/** The newest audit events, optionally for one patient or one account. Never cached: each look is recorded. */
export function useAuditEvents(filters: { patientId?: string; actorId?: string }) {
  return useQuery({
    queryKey: ["audit-events", filters],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/auth/audit-events", {
          params: { query: { patient_id: filters.patientId, actor_id: filters.actorId } },
        }),
      ),
    staleTime: 0,
  });
}

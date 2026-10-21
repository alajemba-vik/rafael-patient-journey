import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { PATIENTS } from "./patients";

export type AccountCreate = Schemas["UserCreate"];

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

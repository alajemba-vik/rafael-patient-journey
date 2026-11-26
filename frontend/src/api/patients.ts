import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./core/client";

type PatientRecord = Schemas["PatientDetail"] | Schemas["PatientAdministrative"];

export const PATIENTS = ["patients"] as const;

/** Patients the person may list. `unassigned`: a coordinator's patients with no coordinator yet. */
export function usePatients(search: string, unassigned = false) {
  return useQuery({
    queryKey: [...PATIENTS, "list", search, unassigned],
    queryFn: () =>
      unwrap(api.GET("/api/v1/patients", { params: { query: { search: search || undefined, unassigned } } })),
    // Keep showing the previous results while the next search loads, instead of flashing.
    placeholderData: keepPreviousData,
  });
}

export function usePatient(patientId: string) {
  return useQuery({
    queryKey: [...PATIENTS, patientId],
    queryFn: () => unwrap(api.GET("/api/v1/patients/{patient_id}", { params: { path: { patient_id: patientId } } })),
  });
}

/** True when the record includes clinical data, i.e. the person is in the patient's care team. */
export function isDetail(patient: PatientRecord): patient is Schemas["PatientDetail"] {
  return "medical_summary" in patient;
}

export function useRegisterPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["PatientCreate"]) => unwrap(api.POST("/api/v1/patients", { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PATIENTS }),
  });
}

/** Corrections to the administrative record. Only the fields sent change. */
export function useUpdatePatient(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["PatientUpdate"]) =>
      unwrap(api.PATCH("/api/v1/patients/{patient_id}", { params: { path: { patient_id: patientId } }, body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PATIENTS }),
  });
}

export type ClinicalProfile = Schemas["ClinicalProfileOut"];
export type ClinicalProfileInput = Schemas["ClinicalProfileIn"];

/** Disease, treatments, social life and habits. The patient and their care team only. */
export function useClinicalProfile(patientId: string) {
  return useQuery({
    queryKey: [...PATIENTS, patientId, "clinical"],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/patients/{patient_id}/clinical-profile", { params: { path: { patient_id: patientId } } }),
      ),
  });
}

/** The care team saves the whole profile at once; treatments replace the previous list. */
export function useSaveClinicalProfile(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClinicalProfileInput) =>
      unwrap(
        api.PUT("/api/v1/patients/{patient_id}/clinical-profile", {
          params: { path: { patient_id: patientId } },
          body,
        }),
      ),
    onSuccess: (saved) => queryClient.setQueryData([...PATIENTS, patientId, "clinical"], saved),
  });
}

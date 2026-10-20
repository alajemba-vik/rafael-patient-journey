import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type PatientSummary = Schemas["PatientAdministrative"];
export type PatientRecord = Schemas["PatientDetail"] | Schemas["PatientAdministrative"];

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
    queryFn: () =>
      unwrap(api.GET("/api/v1/patients/{patient_id}", { params: { path: { patient_id: patientId } } })),
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

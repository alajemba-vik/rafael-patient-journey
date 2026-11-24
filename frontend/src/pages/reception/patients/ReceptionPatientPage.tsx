import { useParams } from "react-router";

import { usePatient } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { PageHeader } from "../../../components/layout/PageHeader";
import { AppointmentsSection } from "../../../components/patient/AppointmentsSection";
import { CareTeamSection } from "../../../components/patient/CareTeamSection";
import { PatientDetailsSection } from "./PatientDetailsSection";

/** What reception needs about a patient: contact details, who follows them, and appointments. */
export function ReceptionPatientPage() {
  const { patientId = "" } = useParams();
  const patient = usePatient(patientId);

  return (
    <QueryState query={patient}>
      {(record) => (
        <>
          <PageHeader title={`${record.first_name} ${record.last_name}`} documentTitle="Fiche patient" />
          <div className="rf-grid rf-section">
            <PatientDetailsSection patient={record} />
            <CareTeamSection patientId={record.id} />
          </div>
          <AppointmentsSection patientId={record.id} />
        </>
      )}
    </QueryState>
  );
}

// React Router loads a lazy route's component from this export.
export { ReceptionPatientPage as Component };

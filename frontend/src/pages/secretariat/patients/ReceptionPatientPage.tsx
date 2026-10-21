import { useParams } from "react-router";

import { usePatient } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatDate } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { AppointmentsSection } from "../../../components/patient/AppointmentsSection";
import { CareTeamSection } from "../../../components/patient/CareTeamSection";

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
            <section className="rf-panel" aria-labelledby="info-title">
              <h2 id="info-title" className="rf-title">
                Coordonnées
              </h2>
              <dl className="rf-dl">
                <dt>Date de naissance</dt>
                <dd>{formatDate(record.birth_date)}</dd>
                <dt>E-mail</dt>
                <dd>{record.email ?? "—"}</dd>
                <dt>Téléphone</dt>
                <dd>{record.phone ?? "—"}</dd>
              </dl>
            </section>
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

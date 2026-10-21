import { useParams } from "react-router";

import { isDetail, usePatient } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatDate } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { AppointmentsSection } from "./AppointmentsSection";
import { CareTeamSection } from "./CareTeamSection";
import { PathwaySection } from "./PathwaySection";
import { ScoresSection } from "./ScoresSection";

export function PatientFilePage() {
  const { patientId = "" } = useParams();
  const patient = usePatient(patientId);

  return (
    <QueryState query={patient}>
      {(record) => (
        <>
          <PageHeader title={`${record.first_name} ${record.last_name}`} documentTitle="Dossier patient" />
          <div className="rf-grid rf-section">
            <section className="rf-panel" aria-labelledby="info-title">
              <h2 id="info-title" className="rf-title">
                Informations
              </h2>
              <dl className="rf-dl">
                <dt>Date de naissance</dt>
                <dd>{formatDate(record.birth_date)}</dd>
                <dt>E-mail</dt>
                <dd>{record.email ?? "—"}</dd>
                <dt>Téléphone</dt>
                <dd>{record.phone ?? "—"}</dd>
                {isDetail(record) && record.medical_summary && (
                  <>
                    <dt>Résumé médical</dt>
                    <dd>{record.medical_summary}</dd>
                  </>
                )}
              </dl>
            </section>
            {isDetail(record) && <CareTeamSection patientId={record.id} />}
            {isDetail(record) && <ScoresSection patientId={record.id} />}
          </div>
          {isDetail(record) ? (
            <>
              <PathwaySection patientId={record.id} />
              <AppointmentsSection patientId={record.id} />
            </>
          ) : (
            <p className="rf-banner">
              Vous voyez les informations administratives de ce patient, qui n’a pas encore de coordinatrice ou de
              coordinateur.
            </p>
          )}
        </>
      )}
    </QueryState>
  );
}

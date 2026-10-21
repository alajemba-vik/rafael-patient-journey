import { useParams } from "react-router";

import { useAddToCareTeam } from "../../../api/careTeam";
import { useMe } from "../../../api/me";
import { isDetail, usePatient } from "../../../api/patients";
import { Button } from "../../../components/forms/Button";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatDate } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { AppointmentsSection } from "../../../components/patient/AppointmentsSection";
import { CareTeamSection } from "../../../components/patient/CareTeamSection";
import { PathwaySection } from "./PathwaySection";
import { ScoresSection } from "./ScoresSection";

export function PatientFilePage() {
  const { patientId = "" } = useParams();
  const patient = usePatient(patientId);
  const me = useMe().data;
  const takeOn = useAddToCareTeam();

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
            <div className="rf-banner rf-stack">
              <p>Ce patient n’a pas encore de coordinatrice ou de coordinateur.</p>
              {me?.role === "coordinator" && (
                <div>
                  <Button
                    pending={takeOn.isPending}
                    onClick={() => takeOn.mutate({ patient_id: record.id, professional_id: me.id })}
                  >
                    Prendre en charge
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </QueryState>
  );
}

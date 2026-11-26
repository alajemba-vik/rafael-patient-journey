import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { paths } from "../../../app/paths";

import { useAddToCareTeam } from "../../../api/care_team";
import { useMe } from "../../../api/identity_access";
import { usePermissions } from "../../../api/identity_access";
import { isDetail, usePatient } from "../../../api/patients";
import { Button } from "../../../components/forms/Button";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatDate } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { AppointmentsSection } from "../../../components/patient/AppointmentsSection";
import { CareTeamSection } from "../../../components/patient/CareTeamSection";
import { AssessmentSection } from "./AssessmentSection";
import { ClinicalProfileSection } from "./ClinicalProfileSection";
import { MessagesSection } from "./MessagesSection";
import { PathwaySection } from "./PathwaySection";
import { ScoresSection } from "./ScoresSection";
import { SessionsSection } from "./SessionsSection";

export function PatientFilePage() {
  const { t } = useTranslation();
  const { patientId = "" } = useParams();
  const patient = usePatient(patientId);
  const me = useMe().data;
  const can = usePermissions();
  const takeOn = useAddToCareTeam();

  return (
    <QueryState query={patient}>
      {(record) => (
        <>
          <PageHeader
            title={`${record.first_name} ${record.last_name}`}
            documentTitle={t("patientFile.documentTitle")}
          />
          {isDetail(record) && (
            <p>
              <Link className="rf-btn rf-btn--secondary" to={paths.pro.report(record.id)}>
                {t("report.open")}
              </Link>
            </p>
          )}
          <div className="rf-grid rf-section">
            <section className="rf-panel" aria-labelledby="info-title">
              <h2 id="info-title" className="rf-title">
                {t("patientFile.info")}
              </h2>
              <dl className="rf-dl">
                <dt>{t("patientFile.birthDate")}</dt>
                <dd>{formatDate(record.birth_date)}</dd>
                <dt>{t("patientFile.email")}</dt>
                <dd>{record.email ?? "—"}</dd>
                <dt>{t("patientFile.phone")}</dt>
                <dd>{record.phone ?? "—"}</dd>
                {isDetail(record) && record.medical_summary && (
                  <>
                    <dt>{t("patientFile.medicalSummary")}</dt>
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
              <ClinicalProfileSection patientId={record.id} />
              <PathwaySection patientId={record.id} />
              <AssessmentSection patientId={record.id} />
              <AppointmentsSection patientId={record.id} />
              <SessionsSection patientId={record.id} />
              <MessagesSection patientId={record.id} />
            </>
          ) : (
            <div className="rf-banner rf-stack">
              <p>{t("patientFile.noCoordinator")}</p>
              {can.takeOnPatients && me && (
                <div>
                  <Button
                    pending={takeOn.isPending}
                    onClick={() => takeOn.mutate({ patient_id: record.id, professional_id: me.id })}
                  >
                    {t("patientFile.takeOn")}
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

// React Router loads a lazy route's component from this export.
export { PatientFilePage as Component };

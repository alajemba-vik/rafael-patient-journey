import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { useCareTeam } from "../../../api/care_team";
import { usePatientAssessments, usePatientPathways } from "../../../api/pathways";
import { isDetail, useClinicalProfile, usePatient } from "../../../api/patients";
import { usePatientScores } from "../../../api/questionnaires";
import { paths } from "../../../app/paths";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { CarePlan } from "../../../components/patient/CarePlan";
import { MilestonesTable } from "../../../components/tables/MilestonesTable";
import { formatChange, formatDate, formatMonth, formatNumber } from "../../../lib/format";
import { AssessmentTable } from "./AssessmentSection";
import { ClinicalSummary } from "./ClinicalProfileSection";

const MONTHS_SHOWN = 6;

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rf-report__section">
      <h2 className="rf-title">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The pathway report, laid out for paper: identity, clinical profile, care team, each
 * milestone with its care plan, the assessment tests and quality of life. "Print" opens the
 * browser's dialog, where "Save as PDF" gives the file to send or file away.
 */
export function PatientReportPage() {
  const { t } = useTranslation();
  const { patientId = "" } = useParams();
  const patient = usePatient(patientId);
  const allowed = patient.data !== undefined && isDetail(patient.data);
  const profile = useClinicalProfile(patientId, allowed);
  const team = useCareTeam(patientId, allowed);
  const pathways = usePatientPathways(patientId, allowed);
  const assessments = usePatientAssessments(patientId, allowed);
  const scores = usePatientScores(patientId, allowed);
  const pathway = pathways.data?.find((p) => p.status === "open") ?? pathways.data?.[0];

  return (
    <QueryState query={patient}>
      {(record) => (
        <article className="rf-report">
          <div className="rf-report__actions rf-no-print">
            <Link to={paths.pro.patient(patientId)}>{t("report.back")}</Link>
            <Button onClick={() => window.print()}>{t("report.print")}</Button>
          </div>
          <header className="rf-report__header">
            <p className="rf-report__brand">{t("report.brand")}</p>
            <h1 className="rf-display-lg">{t("report.title")}</h1>
            <dl className="rf-dl">
              <dt>{t("report.patient")}</dt>
              <dd>
                {record.first_name} {record.last_name}
              </dd>
              <dt>{t("patientFile.birthDate")}</dt>
              <dd>{formatDate(record.birth_date)}</dd>
              {pathway && (
                <>
                  <dt>{t("report.coordinator")}</dt>
                  <dd>{pathway.coordinator_name}</dd>
                  <dt>{t("report.pathway")}</dt>
                  <dd>
                    {t("report.openedOn", { date: formatDate(pathway.opened_at) })}
                    {pathway.closed_at && ` · ${t("report.closedOn", { date: formatDate(pathway.closed_at) })}`}
                  </dd>
                </>
              )}
              <dt>{t("report.printedOn")}</dt>
              <dd>{formatDate(new Date().toISOString())}</dd>
            </dl>
          </header>

          {!isDetail(record) ? (
            <p className="rf-banner">{t("report.notAllowed")}</p>
          ) : (
            <>
              <ReportSection title={t("clinical.title")}>
                <QueryState query={profile}>
                  {(data) =>
                    data.updated_at ? (
                      <ClinicalSummary profile={data} />
                    ) : (
                      <p className="rf-muted">{t("clinical.empty")}</p>
                    )
                  }
                </QueryState>
              </ReportSection>

              <ReportSection title={t("report.careTeam")}>
                <QueryState query={team}>
                  {(members) => (
                    <ul className="rf-plain-list">
                      {members.map((m) => (
                        <li key={m.assignment_id}>
                          {m.full_name}
                          {m.discipline && <span className="rf-muted"> · {m.discipline}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </QueryState>
              </ReportSection>

              <ReportSection title={t("report.milestones")}>
                {pathway && pathway.milestones.length > 0 ? (
                  <>
                    <MilestonesTable milestones={pathway.milestones} />
                    {pathway.milestones.map((m) => (
                      <div key={m.kind} className="rf-report__milestone">
                        <h3 className="rf-subtitle">
                          {t(`labels.milestone.${m.kind}`)} · {formatDate(m.recorded_at)}
                        </h3>
                        <CarePlan goals={m.goal_codes} disciplines={m.discipline_codes} />
                        <dl className="rf-dl">
                          {m.symptoms.length > 0 && (
                            <>
                              <dt>{t("pathway.symptoms")}</dt>
                              <dd>{m.symptoms.map((s) => `${s.name} (${s.intensity})`).join(", ")}</dd>
                            </>
                          )}
                          {m.goals && (
                            <>
                              <dt>{t("pathway.goals")}</dt>
                              <dd>{m.goals}</dd>
                            </>
                          )}
                          {m.plan && (
                            <>
                              <dt>{t("pathway.plan")}</dt>
                              <dd>{m.plan}</dd>
                            </>
                          )}
                          {m.note && (
                            <>
                              <dt>{t("pathway.note")}</dt>
                              <dd>{m.note}</dd>
                            </>
                          )}
                        </dl>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="rf-muted">{t("report.noMilestone")}</p>
                )}
              </ReportSection>

              <ReportSection title={t("assessments.title")}>
                <QueryState query={assessments}>
                  {(list) =>
                    list.length > 0 ? (
                      <AssessmentTable scores={list} />
                    ) : (
                      <p className="rf-muted">{t("assessments.empty")}</p>
                    )
                  }
                </QueryState>
              </ReportSection>

              <ReportSection title={t("scores.title")}>
                <QueryState query={scores}>
                  {(list) =>
                    list.length > 0 ? (
                      <table className="rf-table">
                        <caption className="rf-muted">{t("scores.caption")}</caption>
                        <tbody>
                          {list.slice(-MONTHS_SHOWN).map((s) => (
                            <tr key={s.period}>
                              <th scope="row">{formatMonth(s.period)}</th>
                              <td className="rf-num">{formatNumber(s.score)}</td>
                              <td className="rf-num rf-muted">{s.change === null ? "" : formatChange(s.change)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="rf-muted">{t("scores.empty")}</p>
                    )
                  }
                </QueryState>
              </ReportSection>
            </>
          )}
          <footer className="rf-report__footer">{t("report.confidential")}</footer>
        </article>
      )}
    </QueryState>
  );
}

// React Router loads a lazy route's component from this export.
export { PatientReportPage as Component };

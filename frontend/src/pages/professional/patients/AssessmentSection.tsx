import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { usePatientAssessments, usePatientPathways, useRecordAssessment, type Assessment } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { ASSESSMENT_TESTS, type AssessmentTest } from "../../../lib/carePlan";
import { formatDate, formatNumber } from "../../../lib/format";

const KINDS = ["intake", "review", "final"] as const;
type Kind = (typeof KINDS)[number];

function RecordForm({ pathwayId }: { pathwayId: string }) {
  const { t } = useTranslation();
  const record = useRecordAssessment();
  const [test, setTest] = useState<AssessmentTest>("k10");
  const [kind, setKind] = useState<Kind>("intake");
  const [value, setValue] = useState("");
  const range = ASSESSMENT_TESTS.find((r) => r.test === test)!;
  const number = value.trim() === "" ? null : Number(value.replace(",", "."));
  const valid = number !== null && !Number.isNaN(number) && number >= range.min && number <= range.max;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || number === null) return;
    record.mutate({ pathwayId, body: { kind, test, value: number } }, { onSuccess: () => setValue("") });
  }

  return (
    <form className="rf-stack" onSubmit={submit} aria-label={t("assessments.record")}>
      <p className="rf-title">{t("assessments.record")}</p>
      <div className="rf-row">
        <SelectField
          label={t("assessments.test")}
          value={test}
          onChange={(event) => setTest(event.target.value as AssessmentTest)}
        >
          {ASSESSMENT_TESTS.map((r) => (
            <option key={r.test} value={r.test}>
              {t(`assessments.tests.${r.test}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("assessments.milestone")}
          value={kind}
          onChange={(event) => setKind(event.target.value as Kind)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`labels.milestone.${k}`)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t("assessments.value")}
          hint={t("assessments.valueHint", { min: range.min, max: range.max })}
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      {record.isError && (
        <p className="rf-field__error" role="alert">
          {t("assessments.failed")}
        </p>
      )}
      <div>
        <Button type="submit" pending={record.isPending} disabled={!valid}>
          {t("assessments.save")}
        </Button>
      </div>
    </form>
  );
}

function ScoreCell({ score }: { score: Assessment | undefined }) {
  const { t } = useTranslation();
  if (!score) return <span className="rf-muted">—</span>;
  return (
    <span title={t("assessments.recordedBy", { name: score.recorded_by_name, date: formatDate(score.recorded_at) })}>
      <strong>{formatNumber(score.value)}</strong>
      {score.band && (
        <>
          <br />
          <span className="rf-muted">{t(`assessments.bands.${score.band as "well"}`)}</span>
        </>
      )}
    </span>
  );
}

/** The assessment day's scored tests, one row per test and one column per milestone. */
export function AssessmentSection({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const scores = usePatientAssessments(patientId);
  const pathways = usePatientPathways(patientId);
  const open = pathways.data?.find((p) => p.status === "open");

  return (
    <section className="rf-panel rf-section" aria-labelledby="assessment-title">
      <h2 id="assessment-title" className="rf-title">
        {t("assessments.title")}
      </h2>
      <p className="rf-muted">{t("assessments.intro")}</p>
      <QueryState query={scores} empty={{ isEmpty: (list) => list.length === 0, title: t("assessments.empty") }}>
        {(list) => {
          const tests = ASSESSMENT_TESTS.filter((r) => list.some((s) => s.test === r.test));
          return (
            <div className="rf-table-wrap">
              <table className="rf-table">
                <thead>
                  <tr>
                    <th scope="col">{t("assessments.test")}</th>
                    {KINDS.map((k) => (
                      <th key={k} scope="col">
                        {t(`labels.milestone.${k}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tests.map((r) => (
                    <tr key={r.test}>
                      <th scope="row">{t(`assessments.tests.${r.test}`)}</th>
                      {KINDS.map((k) => (
                        <td key={k}>
                          <ScoreCell score={list.find((s) => s.test === r.test && s.kind === k)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }}
      </QueryState>
      {open ? (
        <RecordForm pathwayId={open.id} />
      ) : (
        pathways.data && <p className="rf-muted">{t("assessments.noPathway")}</p>
      )}
    </section>
  );
}

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, type Schemas } from "../../../api/core/client";
import { useUpdatePatient } from "../../../api/patients";
import { Button } from "../../../components/forms/Button";
import { TextField } from "../../../components/forms/TextField";
import { formatDate, formatPhone } from "../../../lib/format";
import { instituteToday } from "../../../lib/time";

type Patient = Schemas["PatientAdministrative"];

/** Contact details, correctable in place: a typo or a new number no longer waits on paper. */
export function PatientDetailsSection({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  return (
    <section className="rf-panel" aria-labelledby="info-title">
      <h2 id="info-title" className="rf-title">
        {t("patientDetails.title")}
      </h2>
      {editing ? (
        <DetailsForm patient={patient} onDone={() => setEditing(false)} />
      ) : (
        <>
          <dl className="rf-dl">
            <dt>{t("patientForm.birthDate")}</dt>
            <dd>{formatDate(patient.birth_date)}</dd>
            <dt>{t("patientForm.email")}</dt>
            <dd>{patient.email ?? "—"}</dd>
            <dt>{t("patientForm.phone")}</dt>
            <dd>{patient.phone ? formatPhone(patient.phone) : "—"}</dd>
          </dl>
          <div className="rf-actions">
            <Button variant="secondary" className="rf-btn--quiet" onClick={() => setEditing(true)}>
              {t("patientDetails.edit")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function DetailsForm({ patient, onDone }: { patient: Patient; onDone: () => void }) {
  const { t } = useTranslation();
  const update = useUpdatePatient(patient.id);
  const [fields, setFields] = useState({
    first_name: patient.first_name,
    last_name: patient.last_name,
    birth_date: patient.birth_date,
    email: patient.email ?? "",
    phone: patient.phone ?? "",
  });
  const set = (name: keyof typeof fields, value: string) => setFields({ ...fields, [name]: value });

  function submit(event: FormEvent) {
    event.preventDefault();
    // An emptied email or phone is cleared on purpose, so it's sent as null.
    update.mutate({ ...fields, email: fields.email || null, phone: fields.phone || null }, { onSuccess: onDone });
  }

  return (
    <form className="rf-form" onSubmit={submit} aria-label={t("patientDetails.edit")}>
      <div className="rf-row">
        <TextField
          label={t("patientForm.firstName")}
          required
          autoComplete="off"
          value={fields.first_name}
          onChange={(e) => set("first_name", e.target.value)}
        />
        <TextField
          label={t("patientForm.lastName")}
          required
          autoComplete="off"
          value={fields.last_name}
          onChange={(e) => set("last_name", e.target.value)}
        />
      </div>
      <TextField
        label={t("patientForm.birthDate")}
        type="date"
        required
        min="1900-01-01"
        max={instituteToday()}
        value={fields.birth_date}
        onChange={(e) => set("birth_date", e.target.value)}
      />
      <TextField
        label={t("patientForm.email")}
        type="email"
        autoComplete="off"
        value={fields.email}
        onChange={(e) => set("email", e.target.value)}
      />
      <TextField
        label={t("patientForm.phone")}
        type="tel"
        autoComplete="off"
        hint={t("patientForm.phoneHint")}
        value={fields.phone}
        onChange={(e) => set("phone", e.target.value)}
      />
      {update.isError && (
        <p className="rf-field__error" role="alert">
          {update.error instanceof ApiError && update.error.status === 422
            ? t("patientDetails.invalid")
            : t("patientDetails.failed")}
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={update.isPending}>
          {t("common.save")}
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={update.isPending}>
          {t("common.back")}
        </Button>
      </div>
    </form>
  );
}

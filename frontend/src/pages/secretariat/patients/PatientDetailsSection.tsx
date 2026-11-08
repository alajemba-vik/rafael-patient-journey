import { useState, type FormEvent } from "react";

import { ApiError, type Schemas } from "../../../api/core/client";
import { useUpdatePatient } from "../../../api/patients";
import { Button } from "../../../components/forms/Button";
import { TextField } from "../../../components/forms/TextField";
import { formatDate, formatPhone } from "../../../components/format";
import { instituteToday } from "../../../components/time";
import { PHONE_HINT } from "./RegisterPatientForm";

type Patient = Schemas["PatientAdministrative"];

/** Contact details, correctable in place: a typo or a new number no longer waits on paper. */
export function PatientDetailsSection({ patient }: { patient: Patient }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="rf-panel" aria-labelledby="info-title">
      <h2 id="info-title" className="rf-title">
        Coordonnées
      </h2>
      {editing ? (
        <DetailsForm patient={patient} onDone={() => setEditing(false)} />
      ) : (
        <>
          <dl className="rf-dl">
            <dt>Date de naissance</dt>
            <dd>{formatDate(patient.birth_date)}</dd>
            <dt>E-mail</dt>
            <dd>{patient.email ?? "—"}</dd>
            <dt>Téléphone</dt>
            <dd>{patient.phone ? formatPhone(patient.phone) : "—"}</dd>
          </dl>
          <div className="rf-actions">
            <Button variant="secondary" className="rf-btn--quiet" onClick={() => setEditing(true)}>
              Modifier les coordonnées
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function DetailsForm({ patient, onDone }: { patient: Patient; onDone: () => void }) {
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
    <form className="rf-form" onSubmit={submit} aria-label="Modifier les coordonnées">
      <div className="rf-row">
        <TextField
          label="Prénom"
          required
          autoComplete="off"
          value={fields.first_name}
          onChange={(e) => set("first_name", e.target.value)}
        />
        <TextField
          label="Nom"
          required
          autoComplete="off"
          value={fields.last_name}
          onChange={(e) => set("last_name", e.target.value)}
        />
      </div>
      <TextField
        label="Date de naissance"
        type="date"
        required
        min="1900-01-01"
        max={instituteToday()}
        value={fields.birth_date}
        onChange={(e) => set("birth_date", e.target.value)}
      />
      <TextField
        label="E-mail"
        type="email"
        autoComplete="off"
        value={fields.email}
        onChange={(e) => set("email", e.target.value)}
      />
      <TextField
        label="Téléphone"
        type="tel"
        autoComplete="off"
        hint={PHONE_HINT}
        value={fields.phone}
        onChange={(e) => set("phone", e.target.value)}
      />
      {update.isError && (
        <p className="rf-field__error" role="alert">
          {update.error instanceof ApiError && update.error.status === 422
            ? "Vérifiez le téléphone, l’e-mail et la date de naissance."
            : "Les modifications n’ont pas été enregistrées. Réessayez."}
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={update.isPending}>
          Enregistrer
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={update.isPending}>
          Retour
        </Button>
      </div>
    </form>
  );
}

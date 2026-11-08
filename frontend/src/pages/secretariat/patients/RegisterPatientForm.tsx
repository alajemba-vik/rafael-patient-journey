import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { ApiError } from "../../../api/core/client";
import { usePatients, useRegisterPatient } from "../../../api/patients";
import { Button } from "../../../components/forms/Button";
import { TextField } from "../../../components/forms/TextField";
import { formatDate } from "../../../components/format";
import { instituteToday } from "../../../components/time";
import { paths } from "../../../app/paths";

const EMPTY = { first_name: "", last_name: "", birth_date: "", email: "", phone: "" };
type Fields = typeof EMPTY;

export const PHONE_HINT = "Chiffres, espaces ou points, avec l’indicatif +33 si besoin.";

export function RegisterPatientForm() {
  const [fields, setFields] = useState(EMPTY);
  const register = useRegisterPatient();
  const navigate = useNavigate();
  const duplicate = register.error instanceof ApiError && register.error.status === 409;

  function set(name: keyof Fields, value: string) {
    setFields({ ...fields, [name]: value });
    // Any change makes a previous duplicate warning stale.
    if (register.isError) register.reset();
  }

  function save(allowDuplicate: boolean) {
    register.mutate(
      {
        ...fields,
        email: fields.email || null,
        phone: fields.phone || null,
        allow_duplicate: allowDuplicate,
      },
      { onSuccess: (patient) => navigate(paths.reception.patient(patient.id)) },
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save(false);
  }

  return (
    <form className="rf-form rf-narrow" onSubmit={submit}>
      {/* TODO(validate): when does a person get a patient record, and who creates it? (V-06) */}
      <p className="rf-muted">Pour une personne dont l’admission à l’Institut est confirmée.</p>
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
      <div className="rf-row">
        <TextField
          label="E-mail (facultatif)"
          type="email"
          autoComplete="off"
          value={fields.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <TextField
          label="Téléphone (facultatif)"
          type="tel"
          autoComplete="off"
          hint={PHONE_HINT}
          value={fields.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </div>
      {duplicate ? (
        <DuplicateWarning fields={fields} pending={register.isPending} onConfirm={() => save(true)} />
      ) : (
        register.isError && (
          <p className="rf-field__error" role="alert">
            L’enregistrement n’a pas abouti. Vérifiez les informations, puis réessayez.
          </p>
        )
      )}
      {!duplicate && (
        <Button type="submit" pending={register.isPending}>
          Enregistrer le patient
        </Button>
      )}
    </form>
  );
}

/**
 * Same name and birth date as someone already registered: most often the same person, so
 * reception opens the existing record; a true namesake can still be registered on purpose.
 */
function DuplicateWarning(props: { fields: Fields; pending: boolean; onConfirm: () => void }) {
  const { fields } = props;
  const matches = usePatients(fields.last_name).data?.filter(
    (p) =>
      fold(p.first_name) === fold(fields.first_name) &&
      fold(p.last_name) === fold(fields.last_name) &&
      p.birth_date === fields.birth_date,
  );

  return (
    <div className="rf-panel rf-panel--highlight" role="alert">
      <p>
        <strong>Ce patient semble déjà enregistré</strong> : même nom, même prénom, même date de naissance.
      </p>
      {matches && matches.length > 0 && (
        <ul className="rf-list">
          {matches.map((p) => (
            <li key={p.id}>
              <Link className="rf-link" to={paths.reception.patient(p.id)}>
                Ouvrir la fiche de {p.first_name} {p.last_name}, né·e le {formatDate(p.birth_date)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="rf-actions">
        <Button variant="secondary" pending={props.pending} onClick={props.onConfirm}>
          C’est une autre personne : enregistrer quand même
        </Button>
      </div>
    </div>
  );
}

/** Same comparison as the API: no case, no accents ("Elodie" is "Élodie"). */
function fold(name: string): string {
  return name.trim().normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
}

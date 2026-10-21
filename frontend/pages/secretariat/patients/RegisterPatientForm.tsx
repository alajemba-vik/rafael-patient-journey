import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { useRegisterPatient } from "../../../api/patients";
import { Button } from "../../../components/forms/Button";
import { TextField } from "../../../components/forms/TextField";
import { paths } from "../../../app/paths";

const EMPTY = { first_name: "", last_name: "", birth_date: "", email: "", phone: "" };

export function RegisterPatientForm() {
  const [fields, setFields] = useState(EMPTY);
  const register = useRegisterPatient();
  const navigate = useNavigate();

  function set(name: keyof typeof EMPTY, value: string) {
    setFields({ ...fields, [name]: value });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    register.mutate(
      { ...fields, email: fields.email || null, phone: fields.phone || null },
      { onSuccess: (patient) => navigate(paths.reception.patient(patient.id)) },
    );
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
          value={fields.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </div>
      {register.isError && (
        <p className="rf-field__error" role="alert">
          L’enregistrement n’a pas abouti. Vérifiez les informations, puis réessayez.
        </p>
      )}
      <Button type="submit" pending={register.isPending}>
        Enregistrer le patient
      </Button>
    </form>
  );
}

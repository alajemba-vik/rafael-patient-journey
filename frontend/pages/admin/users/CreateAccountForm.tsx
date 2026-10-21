import { useState, type FormEvent } from "react";

import { ApiError } from "../../../api/client";
import { useCreateAccount, type AccountCreate } from "../../../api/accounts";
import { usePatients } from "../../../api/patients";
import { Button } from "../../../components/forms/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { ROLE_LABELS } from "../../../components/labels";

type Role = AccountCreate["role"];
const ROLES: Role[] = ["patient", "secretary", "professional", "coordinator", "admin"];
const MIN_PASSWORD = 12;

export function CreateAccountForm() {
  const create = useCreateAccount();
  const patients = usePatients("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("patient");
  const [discipline, setDiscipline] = useState("");
  const [password, setPassword] = useState("");
  const [patientId, setPatientId] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const practises = role === "professional" || role === "coordinator";
  const withoutLogin = (patients.data ?? []).filter((p) => !p.has_account);

  function submit(event: FormEvent) {
    event.preventDefault();
    setCreated(null);
    const account = { full_name: fullName, email, role, password, discipline: practises ? discipline || null : null };
    create.mutate(
      { account, patientId: role === "patient" ? patientId : undefined },
      {
        onSuccess: (user) => {
          setCreated(user.full_name);
          setFullName("");
          setEmail("");
          setPassword("");
          setDiscipline("");
          setPatientId("");
        },
      },
    );
  }

  const error =
    create.error instanceof ApiError && create.error.status === 409
      ? "Un compte existe déjà avec cette adresse e-mail."
      : create.isError
        ? "La création n’a pas abouti. Vérifiez les informations, puis réessayez."
        : undefined;

  return (
    <form className="rf-form rf-narrow" onSubmit={submit}>
      <SelectField label="Rôle" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>
      {role === "patient" && (
        <SelectField
          label="Dossier patient"
          required
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          hint="Le compte donnera accès à l’espace patient de ce dossier. Seuls les dossiers sans compte sont proposés."
        >
          <option value="">Choisir un dossier</option>
          {withoutLogin.map((p) => (
            <option key={p.id} value={p.id}>
              {p.last_name.toUpperCase()} {p.first_name}
            </option>
          ))}
        </SelectField>
      )}
      <TextField
        label="Nom complet"
        required
        autoComplete="off"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <TextField
        label="Adresse e-mail"
        type="email"
        required
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {practises && (
        <TextField
          label="Discipline (facultatif)"
          hint="Par exemple : Sophrologie, Activité physique adaptée."
          value={discipline}
          maxLength={120}
          onChange={(e) => setDiscipline(e.target.value)}
        />
      )}
      {/* TODO(validate): invitation e-mails instead of an initial password set by an admin? */}
      <TextField
        label="Mot de passe initial"
        type="password"
        required
        minLength={MIN_PASSWORD}
        autoComplete="new-password"
        hint={`${MIN_PASSWORD} caractères minimum, à transmettre à la personne en main propre.`}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p className="rf-field__error" role="alert">
          {error}
        </p>
      )}
      {created && (
        <p className="rf-banner" role="status">
          Compte créé pour {created}.
        </p>
      )}
      <Button type="submit" pending={create.isPending}>
        Créer le compte
      </Button>
    </form>
  );
}

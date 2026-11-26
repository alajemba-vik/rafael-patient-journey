import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../../api/core/client";
import { useCreateAccount, type AccountCreate } from "../../../api/identity_access";
import { usePatients } from "../../../api/patients";
import { Button } from "../../../components/forms/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";

type Role = AccountCreate["role"];
const ROLES: Role[] = ["patient", "secretary", "professional", "coordinator", "admin"];
const MIN_PASSWORD = 12;

export function CreateAccountForm() {
  const { t } = useTranslation();
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
      ? t("accounts.errorExists")
      : create.isError
        ? t("accounts.errorGeneric")
        : undefined;

  return (
    <form className="rf-form rf-narrow" onSubmit={submit}>
      <SelectField label={t("accounts.role")} value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`labels.role.${r}`)}
          </option>
        ))}
      </SelectField>
      {role === "patient" && (
        <SelectField
          label={t("accounts.patientRecord")}
          required
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          hint={t("accounts.patientRecordHint")}
        >
          <option value="">{t("accounts.chooseRecord")}</option>
          {withoutLogin.map((p) => (
            <option key={p.id} value={p.id}>
              {p.last_name.toUpperCase()} {p.first_name}
            </option>
          ))}
        </SelectField>
      )}
      <TextField
        label={t("accounts.fullName")}
        required
        autoComplete="off"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <TextField
        label={t("accounts.email")}
        type="email"
        required
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {practises && (
        <TextField
          label={t("accounts.discipline")}
          hint={t("accounts.disciplineHint")}
          value={discipline}
          maxLength={120}
          onChange={(e) => setDiscipline(e.target.value)}
        />
      )}
      <TextField
        label={t("accounts.password")}
        type="password"
        required
        minLength={MIN_PASSWORD}
        autoComplete="new-password"
        hint={t("accounts.passwordHint", { min: MIN_PASSWORD })}
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
          {t("accounts.created", { name: created })}
        </p>
      )}
      <Button type="submit" pending={create.isPending}>
        {t("accounts.submit")}
      </Button>
    </form>
  );
}

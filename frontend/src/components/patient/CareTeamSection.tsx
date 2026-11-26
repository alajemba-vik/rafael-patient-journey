import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useAddToCareTeam, useCareStaff, useCareTeam, useRemoveFromCareTeam } from "../../api/care_team";
import { usePermissions } from "../../api/identity_access";
import { QueryState } from "../feedback/QueryState";
import { Button } from "../forms/Button";
import { ConfirmButton } from "../forms/ConfirmButton";
import { SelectField } from "../forms/SelectField";
import { TextField } from "../forms/TextField";
import { formatDate } from "../../lib/format";

const REASONS = ["care_team", "convocation", "booking", "medical_opinion", "administrative", "file_merge"] as const;
type Reason = (typeof REASONS)[number];

export function CareTeamSection({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const team = useCareTeam(patientId);
  const can = usePermissions();
  const canManage = can.manageCareTeam;
  const remove = useRemoveFromCareTeam();

  return (
    <section className="rf-panel" aria-labelledby="team-title">
      <h2 id="team-title" className="rf-title">
        {t("careTeam.title")}
      </h2>
      <QueryState query={team} empty={{ isEmpty: (list) => list.length === 0, title: t("careTeam.empty") }}>
        {(members) => (
          <ul className="rf-list">
            {members.map((m) => (
              <li key={m.assignment_id}>
                <span>
                  {m.full_name}
                  <br />
                  <span className="rf-muted">{m.discipline ?? t(`labels.role.${m.role}`)}</span>
                  {m.reason && m.reason !== "care_team" && (
                    <>
                      <br />
                      <span className="rf-chip">{t(`careTeam.reasons.${m.reason}`)}</span>
                    </>
                  )}
                  {m.added_by_name && m.added_at && (
                    <>
                      <br />
                      <span className="rf-muted">
                        {t("careTeam.sharedBy", { name: m.added_by_name, date: formatDate(m.added_at) })}
                      </span>
                    </>
                  )}
                  {m.note && (
                    <>
                      <br />
                      <span className="rf-muted">« {m.note} »</span>
                    </>
                  )}
                </span>
                {canManage && (
                  <ConfirmButton
                    question={t("careTeam.removeQuestion", { name: m.full_name })}
                    confirmLabel={t("careTeam.remove")}
                    onConfirm={() => remove.mutate(m.assignment_id)}
                    pending={remove.isPending && remove.variables === m.assignment_id}
                  >
                    {t("careTeam.remove")}
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      {can.shareFiles && team.data && (
        <AddMemberForm patientId={patientId} memberIds={new Set(team.data.map((m) => m.user_id))} />
      )}
    </section>
  );
}

function AddMemberForm({ patientId, memberIds }: { patientId: string; memberIds: Set<string> }) {
  const { t } = useTranslation();
  const staff = useCareStaff();
  const add = useAddToCareTeam();
  const [chosen, setChosen] = useState("");
  const [reason, setReason] = useState<Reason>("care_team");
  const [note, setNote] = useState("");
  const available = (staff.data ?? [])
    .filter((s) => !memberIds.has(s.id))
    .sort((a, b) => (a.discipline ?? "").localeCompare(b.discipline ?? "") || a.full_name.localeCompare(b.full_name));

  function submit(event: FormEvent) {
    event.preventDefault();
    add.mutate(
      { patient_id: patientId, professional_id: chosen, reason, note: note || null },
      {
        onSuccess: () => {
          setChosen("");
          setReason("care_team");
          setNote("");
        },
      },
    );
  }

  return (
    <form className="rf-form" onSubmit={submit}>
      <SelectField label={t("careTeam.addLabel")} required value={chosen} onChange={(e) => setChosen(e.target.value)}>
        <option value="">{t("careTeam.choosePerson")}</option>
        {available.map((s) => (
          <option key={s.id} value={s.id}>
            {s.discipline ?? t(`labels.role.${s.role}`)} · {s.full_name}
          </option>
        ))}
      </SelectField>
      <SelectField label={t("careTeam.reason")} value={reason} onChange={(e) => setReason(e.target.value as Reason)}>
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {t(`careTeam.reasons.${r}`)}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t("careTeam.note")}
        hint={t("careTeam.noteHint")}
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
      />
      {add.isError && (
        <p className="rf-field__error" role="alert">
          {t("careTeam.addFailed")}
        </p>
      )}
      <Button type="submit" variant="secondary" pending={add.isPending}>
        {t("careTeam.add")}
      </Button>
    </form>
  );
}

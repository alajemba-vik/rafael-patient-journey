import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useCareStaff } from "../../../api/care_team";
import { ApiError } from "../../../api/core/client";
import { useMe } from "../../../api/identity_access";
import { useCreateGroupSession } from "../../../api/scheduling";
import { Button } from "../../../components/forms/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { addDays, instituteDateTime, instituteToday } from "../../../lib/time";

const DURATIONS = [45, 60, 90, 120];

/** Plan a session: what, who leads it (oneself for a practitioner), when, and how many places. */
export function GroupSessionForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const me = useMe().data;
  const leadsOwn = me?.role === "professional";
  const staff = useCareStaff();
  const create = useCreateGroupSession();
  const [title, setTitle] = useState("");
  const [leader, setLeader] = useState("");
  const [day, setDay] = useState(addDays(instituteToday(), 1));
  const [time, setTime] = useState("10:00");
  const [minutes, setMinutes] = useState(60);
  const [capacity, setCapacity] = useState(12);
  const professionalId = leadsOwn ? me?.id : leader;
  const ready = title.trim() !== "" && Boolean(professionalId) && capacity >= 1 && capacity <= 30;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !professionalId) return;
    const startsAt = instituteDateTime(day, time);
    create.mutate(
      {
        title: title.trim(),
        professional_id: professionalId,
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + minutes * 60_000).toISOString(),
        capacity,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="rf-panel rf-stack" onSubmit={submit} aria-label={t("groups.newTitle")}>
      <p className="rf-title">{t("groups.newTitle")}</p>
      <TextField
        label={t("groups.titleLabel")}
        hint={t("groups.titleHint")}
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
      />
      {!leadsOwn && (
        <SelectField label={t("groups.leader")} value={leader} onChange={(e) => setLeader(e.target.value)}>
          <option value="">{t("groups.chooseLeader")}</option>
          {(staff.data ?? []).map((person) => (
            <option key={person.id} value={person.id}>
              {person.full_name}
              {person.discipline ? ` · ${person.discipline}` : ""}
            </option>
          ))}
        </SelectField>
      )}
      <div className="rf-row">
        <TextField label={t("groups.day")} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <TextField label={t("groups.time")} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <SelectField label={t("groups.duration")} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {DURATIONS.map((m) => (
            <option key={m} value={m}>
              {t("groups.minutes", { count: m })}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t("groups.capacity")}
          hint={t("groups.capacityHint")}
          type="number"
          min={1}
          max={30}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
      </div>
      {create.isError && (
        <p className="rf-field__error" role="alert">
          {create.error instanceof ApiError && create.error.status === 409
            ? t("groups.busy")
            : t("groups.createFailed")}
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={create.isPending} disabled={!ready}>
          {t("groups.create")}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {t("groups.cancelForm")}
        </Button>
      </div>
    </form>
  );
}

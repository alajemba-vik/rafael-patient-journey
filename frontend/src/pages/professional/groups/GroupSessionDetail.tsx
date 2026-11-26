import { useState } from "react";
import { useTranslation } from "react-i18next";

import { usePatients } from "../../../api/patients";
import {
  useCancelGroupSession,
  useEnroll,
  useGroupSession,
  useRecordAttendance,
  useUnenroll,
} from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { ConfirmButton } from "../../../components/forms/ConfirmButton";
import { TextField } from "../../../components/forms/TextField";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";

function EnrollPatient({ sessionId, enrolledIds }: { sessionId: string; enrolledIds: string[] }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const results = usePatients(debounced);
  const enroll = useEnroll(sessionId);
  const candidates = (results.data ?? []).filter((p) => !enrolledIds.includes(p.id)).slice(0, 6);

  return (
    <div className="rf-stack">
      <TextField label={t("groups.findPatient")} value={search} onChange={(e) => setSearch(e.target.value)} />
      {debounced.length >= 2 && (
        <ul className="rf-list">
          {candidates.length === 0 && <li className="rf-muted">{t("groups.noMatch")}</li>}
          {candidates.map((patient) => {
            const name = `${patient.first_name} ${patient.last_name}`;
            return (
              <li key={patient.id}>
                <span>{name}</span>
                <Button
                  variant="secondary"
                  pending={enroll.isPending && enroll.variables === patient.id}
                  onClick={() => enroll.mutate(patient.id, { onSuccess: () => setSearch("") })}
                >
                  {t("groups.enroll", { name })}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {enroll.isError && (
        <p className="rf-field__error" role="alert">
          {t("groups.enrollFailed")}
        </p>
      )}
    </div>
  );
}

/** Who is enrolled, places left, attendance once begun, and cancelling the session. */
export function GroupSessionDetail({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const detail = useGroupSession(sessionId);
  const unenroll = useUnenroll(sessionId);
  const attendance = useRecordAttendance(sessionId);
  const cancel = useCancelGroupSession(sessionId);

  return (
    <QueryState query={detail}>
      {(session) => {
        const started = new Date(session.starts_at) <= new Date();
        const over = new Date(session.ends_at) < new Date();
        const open = session.status === "scheduled" && !over;
        return (
          <div className="rf-stack">
            <p className="rf-muted">{t("groups.places", { enrolled: session.enrolled, capacity: session.capacity })}</p>
            {session.participants.length === 0 ? (
              <p className="rf-muted">{t("groups.nobody")}</p>
            ) : (
              <ul className="rf-list" aria-label={t("groups.participants")}>
                {session.participants.map((p) => (
                  <li key={p.patient_id}>
                    <span>
                      {p.patient_name}
                      {p.status !== "enrolled" && (
                        <span className="rf-muted"> · {t(`groups.attendance.${p.status}`)}</span>
                      )}
                    </span>
                    <span className="rf-actions">
                      {started && session.status === "scheduled" && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => attendance.mutate({ patientId: p.patient_id, status: "attended" })}
                            disabled={p.status === "attended"}
                          >
                            {t("groups.markAttended", { name: p.patient_name })}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => attendance.mutate({ patientId: p.patient_id, status: "no_show" })}
                            disabled={p.status === "no_show"}
                          >
                            {t("groups.markNoShow", { name: p.patient_name })}
                          </Button>
                        </>
                      )}
                      {open && !started && (
                        <Button
                          variant="secondary"
                          pending={unenroll.isPending && unenroll.variables === p.patient_id}
                          onClick={() => unenroll.mutate(p.patient_id)}
                        >
                          {t("groups.remove", { name: p.patient_name })}
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {open && session.enrolled < session.capacity && (
              <EnrollPatient sessionId={sessionId} enrolledIds={session.participants.map((p) => p.patient_id)} />
            )}
            {open && (
              <div>
                <ConfirmButton
                  question={t("groups.cancelQuestion", { count: session.enrolled })}
                  confirmLabel={t("groups.cancelSession")}
                  onConfirm={() => cancel.mutate(undefined)}
                  pending={cancel.isPending}
                >
                  {t("groups.cancelSession")}
                </ConfirmButton>
              </div>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}

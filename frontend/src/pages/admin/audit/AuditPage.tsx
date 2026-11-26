import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useAuditEvents } from "../../../api/identity_access";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { TextField } from "../../../components/forms/TextField";
import { PageHeader } from "../../../components/layout/PageHeader";
import { formatDate, formatTime } from "../../../lib/format";

// The backend sends this many events at most per page; a full page means there may be more.
const PAGE_SIZE = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AuditPage() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const events = useAuditEvents(patientId, before);
  const invalid = draft.trim() !== "" && !UUID.test(draft.trim());

  function filter(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    setPatientId(draft.trim() || null);
    setBefore(null);
  }

  return (
    <div>
      <PageHeader title={t("audit.title")} />
      <p className="rf-muted rf-section">{t("audit.intro")}</p>
      <form className="rf-stack rf-section" onSubmit={filter}>
        <TextField
          label={t("audit.patientFilter")}
          hint={t("audit.patientFilterHint")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          error={invalid ? t("audit.invalidId") : undefined}
        />
        <div className="rf-actions">
          <Button type="submit" disabled={invalid}>
            {t("audit.filter")}
          </Button>
          {patientId && (
            <Button
              variant="secondary"
              onClick={() => {
                setDraft("");
                setPatientId(null);
                setBefore(null);
              }}
            >
              {t("audit.clear")}
            </Button>
          )}
        </div>
      </form>
      <QueryState query={events} empty={{ isEmpty: (list) => list.length === 0, title: t("audit.empty") }}>
        {(list) => (
          <>
            <table className="rf-table">
              <thead>
                <tr>
                  <th scope="col">{t("audit.when")}</th>
                  <th scope="col">{t("audit.who")}</th>
                  <th scope="col">{t("audit.action")}</th>
                  <th scope="col">{t("audit.patient")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {formatDate(e.occurred_at)} {formatTime(e.occurred_at)}
                    </td>
                    <td>
                      {e.actor_name || t("audit.unknown")}
                      {e.actor_role && <span className="rf-muted"> · {t(`labels.role.${e.actor_role}`)}</span>}
                    </td>
                    <td>
                      <code>{e.action}</code>{" "}
                      {e.action.endsWith(".denied") && (
                        <span className="rf-badge rf-badge--no_show">{t("audit.denied")}</span>
                      )}
                    </td>
                    <td>{e.patient_id ? <code>{e.patient_id}</code> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="rf-actions rf-section">
              {before && (
                <Button variant="secondary" onClick={() => setBefore(null)}>
                  {t("audit.newest")}
                </Button>
              )}
              {list.length >= PAGE_SIZE && (
                <Button variant="secondary" onClick={() => setBefore(list[list.length - 1].occurred_at)}>
                  {t("audit.more")}
                </Button>
              )}
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}

// React Router loads a lazy route's component from this export.
export { AuditPage as Component };

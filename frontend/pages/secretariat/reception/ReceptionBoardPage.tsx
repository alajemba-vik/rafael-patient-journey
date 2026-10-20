import { Link } from "react-router";

import { useChangeStatus, useTodayBoard, type BoardStatus } from "../../../api/reception";
import type { Appointment } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/forms/Button";
import { formatTime, formatWeekday } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";

/** What reception can do next from each status, with an undo for a mistaken click. */
const ACTIONS: Record<BoardStatus, { status: BoardStatus; label: string; primary?: boolean }[]> = {
  scheduled: [
    { status: "arrived", label: "Arrivé·e", primary: true },
    { status: "no_show", label: "Absent·e" },
  ],
  arrived: [
    { status: "done", label: "Terminé" },
    { status: "scheduled", label: "Annuler l’arrivée" },
  ],
  no_show: [{ status: "scheduled", label: "Annuler l’absence" }],
  done: [],
  cancelled: [],
};

function count(list: Appointment[], status: BoardStatus): number {
  return list.filter((a) => a.status === status).length;
}

export function ReceptionBoardPage() {
  const board = useTodayBoard();
  const change = useChangeStatus();

  return (
    <>
      <PageHeader title="Accueil du jour" />
      <p className="rf-muted">{formatWeekday(new Date().toISOString())} · mis à jour automatiquement</p>
      {change.isError && (
        <p className="rf-banner" role="alert">
          Le changement n’a pas été enregistré. Réessayez.
        </p>
      )}
      <QueryState
        query={board}
        empty={{ isEmpty: (list) => list.length === 0, title: "Aucun rendez-vous aujourd’hui." }}
      >
        {(list) => (
          <>
            <p className="rf-section" aria-live="polite">
              {list.length} rendez-vous · {count(list, "arrived")} arrivé·e·s · {count(list, "done")} terminé
              {count(list, "done") > 1 ? "s" : ""} · {count(list, "no_show")} absent·e·s
            </p>
            <div className="rf-table-wrap">
              <table className="rf-table">
                <thead>
                  <tr>
                    <th scope="col">Heure</th>
                    <th scope="col">Patient</th>
                    <th scope="col">Avec</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td>{formatTime(a.starts_at)}</td>
                      <td>
                        <Link className="rf-link" to={`/accueil/patients/${a.patient_id}`}>
                          {a.patient_name}
                        </Link>
                      </td>
                      <td>{a.professional_name}</td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                      <td>
                        <div className="rf-actions">
                          {ACTIONS[a.status].map((action) => (
                            <Button
                              key={action.status}
                              variant={action.primary ? "primary" : "secondary"}
                              className="rf-btn--compact"
                              pending={
                                change.isPending &&
                                change.variables?.appointmentId === a.id &&
                                change.variables.status === action.status
                              }
                              onClick={() => change.mutate({ appointmentId: a.id, status: action.status })}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}

import { useState } from "react";
import { Link } from "react-router";

import { useMyAppointments, type Appointment } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { formatTime, formatWeekday } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { addDays, instituteDateTime, instituteToday } from "../../../components/time";
import { paths } from "../../../app/paths";

const DAYS_SHOWN = 7;
// Reception marks arrivals: check for them every minute while the page is open.
const REFRESH_MS = 60_000;

/** From today's midnight at the Institute to the same midnight a week later. */
function thisWeek() {
  const today = instituteToday();
  return {
    start: instituteDateTime(today).toISOString(),
    end: instituteDateTime(addDays(today, DAYS_SHOWN)).toISOString(),
  };
}

function byDay(appointments: Appointment[]): [string, Appointment[]][] {
  const days = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const day = formatWeekday(a.starts_at);
    days.set(day, [...(days.get(day) ?? []), a]);
  }
  return [...days];
}

export function SchedulePage() {
  // Fixed once per visit, so the query key doesn't change on every render.
  const [range] = useState(thisWeek);
  const appointments = useMyAppointments(range, REFRESH_MS);

  return (
    <>
      <PageHeader title="Mon planning" />
      <QueryState
        query={appointments}
        empty={{ isEmpty: (list) => list.length === 0, title: "Aucun rendez-vous dans les sept prochains jours." }}
      >
        {(list) =>
          byDay(list).map(([day, items]) => (
            <section key={day} className="rf-section" aria-label={day}>
              <h2 className="rf-title">{day}</h2>
              <ul className="rf-list">
                {items.map((a) => (
                  <li key={a.id}>
                    <span>
                      <strong>{formatTime(a.starts_at)}</strong>{" "}
                      <Link className="rf-link" to={paths.pro.patient(a.patient_id)}>
                        {a.patient_name}
                      </Link>
                    </span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        }
      </QueryState>
    </>
  );
}

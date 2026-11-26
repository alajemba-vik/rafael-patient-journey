import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useMyAppointments, type Appointment } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { formatTime, formatWeekday } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { addDays, instituteDateTime, instituteToday } from "../../../lib/time";
import { paths } from "../../../app/paths";

const DAYS_SHOWN = 7;
const REFRESH_MS = 60_000;

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
  const { t } = useTranslation();
  const [range] = useState(thisWeek);
  const appointments = useMyAppointments(range, REFRESH_MS);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <PageHeader title={t("schedule.title")} />
      <QueryState query={appointments} empty={{ isEmpty: (list) => list.length === 0, title: t("schedule.empty") }}>
        {(list) =>
          byDay(list).map(([day, items]) => (
            <section key={day} className="rf-section" aria-label={day}>
              <h2
                className="rf-title"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "var(--space-4)",
                  color: "var(--ink)",
                }}
              >
                <span aria-hidden="true">📅</span> {day}
              </h2>

              <div className="rf-stack" style={{ gap: "var(--space-3)" }}>
                {items.map((a) => (
                  <div
                    key={a.id}
                    className="rf-panel"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "var(--space-4) var(--space-5)",
                      borderLeft: "4px solid var(--accent)",
                      flexWrap: "wrap",
                      gap: "var(--space-4)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 800,
                          fontSize: "18px",
                          color: "var(--accent)",
                          background: "var(--accent-doux)",
                          padding: "4px 12px",
                          borderRadius: "var(--radius-xs)",
                        }}
                      >
                        {formatTime(a.starts_at)}
                      </span>
                      <Link
                        className="rf-link"
                        to={paths.pro.patient(a.patient_id)}
                        style={{ fontWeight: 600, fontSize: "16px" }}
                      >
                        {a.patient_name}
                      </Link>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </section>
          ))
        }
      </QueryState>
    </div>
  );
}

export { SchedulePage as Component };

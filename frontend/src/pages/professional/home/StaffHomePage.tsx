import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useMe } from "../../../api/identity_access";
import { useNotifications } from "../../../api/notifications";
import { useOpenNeeds, useTasks } from "../../../api/pathways";
import { useMyAppointments } from "../../../api/scheduling";
import { paths } from "../../../app/paths";
import { QueryState } from "../../../components/feedback/QueryState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { PageHeader } from "../../../components/layout/PageHeader";
import { formatDate, formatTime } from "../../../lib/format";
import { addDays, instituteDateTime, instituteToday } from "../../../lib/time";

const TASKS_SHOWN = 5;
const REFRESH_MS = 60_000;

function today() {
  const day = instituteToday();
  return { start: instituteDateTime(day).toISOString(), end: instituteDateTime(addDays(day, 1)).toISOString() };
}

function TodayPanel() {
  const { t } = useTranslation();
  const [range] = useState(today);
  const appointments = useMyAppointments(range, REFRESH_MS);
  return (
    <section className="rf-panel" aria-labelledby="home-today">
      <div className="rf-section-head">
        <h2 id="home-today" className="rf-title">
          {t("staffHome.today")}
        </h2>
        <Link to={paths.pro.schedule}>{t("staffHome.seeSchedule")}</Link>
      </div>
      <QueryState
        query={appointments}
        empty={{ isEmpty: (list) => list.length === 0, title: t("staffHome.noSession") }}
      >
        {(list) => (
          <ul className="rf-cards">
            {list.map((a) => (
              <li key={a.id} className="rf-card">
                <div className="rf-section-head">
                  <span>
                    <strong>{formatTime(a.starts_at)}</strong> ·{" "}
                    <Link to={paths.pro.patient(a.patient_id)}>{a.patient_name}</Link>
                  </span>
                  <StatusBadge status={a.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </section>
  );
}

function TasksPanel() {
  const { t } = useTranslation();
  const tasks = useTasks();
  return (
    <section className="rf-panel" aria-labelledby="home-tasks">
      <div className="rf-section-head">
        <h2 id="home-tasks" className="rf-title">
          {t("staffHome.tasks")}
        </h2>
        <Link to={paths.tasks}>{t("staffHome.seeTasks")}</Link>
      </div>
      <QueryState query={tasks}>
        {(list) => {
          const open = list.filter((task) => task.status !== "done");
          if (open.length === 0) return <p className="rf-muted">{t("staffHome.noTask")}</p>;
          return (
            <>
              <p>{t("staffHome.openTasks", { count: open.length })}</p>
              <ul className="rf-plain-list">
                {open.slice(0, TASKS_SHOWN).map((task) => (
                  <li key={task.id}>
                    <strong>{task.title}</strong>
                    {task.patient_name && ` · ${task.patient_name}`}
                    {task.due_on && <span className="rf-muted"> · {formatDate(task.due_on)}</span>}
                  </li>
                ))}
              </ul>
            </>
          );
        }}
      </QueryState>
    </section>
  );
}

function InboxPanel({ coordinator }: { coordinator: boolean }) {
  const { t } = useTranslation();
  const notifications = useNotifications();
  const needs = useOpenNeeds(coordinator);
  const unread = notifications.data?.unread;
  return (
    <section className="rf-panel" aria-labelledby="home-inbox">
      <h2 id="home-inbox" className="rf-title">
        {t("staffHome.inbox")}
      </h2>
      <ul className="rf-plain-list">
        <li>
          <Link to={paths.notifications}>
            {unread === undefined ? t("staffHome.notifications") : t("staffHome.unread", { count: unread })}
          </Link>
        </li>
        {coordinator && (
          <li>
            <Link to={paths.pro.needs}>
              {needs.data === undefined ? t("nav.proNeeds") : t("staffHome.needs", { count: needs.data.length })}
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Where practitioners and coordinators land: today's sessions, what to do, what came in. */
export function StaffHomePage() {
  const { t } = useTranslation();
  const me = useMe().data;
  return (
    <>
      <PageHeader title={me ? t("staffHome.hello", { name: me.full_name }) : t("staffHome.title")} />
      <div className="rf-grid rf-section">
        <TodayPanel />
        <TasksPanel />
        <InboxPanel coordinator={me?.role === "coordinator"} />
      </div>
    </>
  );
}

// React Router loads a lazy route's component from this export.
export { StaffHomePage as Component };

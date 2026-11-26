import { useTranslation } from "react-i18next";

import { useMyGroupSessions } from "../../../api/scheduling";
import { formatTime, formatWeekday } from "../../../lib/format";

/** The classes and workshops the patient is enrolled in. Nothing is shown when there are none. */
export function MyGroupSessions() {
  const { t } = useTranslation();
  const sessions = useMyGroupSessions();
  const upcoming = (sessions.data ?? []).filter((s) => s.status === "scheduled");
  if (upcoming.length === 0) return null;

  return (
    <section className="rf-section rf-stack" aria-labelledby="my-groups-title">
      <h2 id="my-groups-title" className="rf-title">
        {t("groups.mineTitle")}
      </h2>
      <ul className="rf-list">
        {upcoming.map((session) => (
          <li key={session.id}>
            <span>
              <strong>{session.title}</strong> {t("groups.mineWith", { name: session.professional_name })}
              <br />
              <span className="rf-muted">
                {formatWeekday(session.starts_at)}, {formatTime(session.starts_at)}–{formatTime(session.ends_at)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

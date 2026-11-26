import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useGroupSessions } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { PageHeader } from "../../../components/layout/PageHeader";
import { formatTime, formatWeekday } from "../../../lib/format";
import { GroupSessionDetail } from "./GroupSessionDetail";
import { GroupSessionForm } from "./GroupSessionForm";

/** Classes and workshops: plan them, fill their places, record who came. */
export function GroupSessionsPage() {
  const { t } = useTranslation();
  const sessions = useGroupSessions();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="rf-narrow">
      <PageHeader title={t("groups.title")}>
        {!creating && <Button onClick={() => setCreating(true)}>{t("groups.new")}</Button>}
      </PageHeader>
      <p className="rf-muted rf-section">{t("groups.intro")}</p>
      {creating && <GroupSessionForm onDone={() => setCreating(false)} />}
      <QueryState
        query={sessions}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: t("groups.empty"),
          children: <p>{t("groups.emptyHint")}</p>,
        }}
      >
        {(list) => (
          <ul className="rf-list rf-section">
            {list.map((session) => {
              const expanded = open === session.id;
              const cancelled = session.status === "cancelled";
              return (
                <li key={session.id} className="rf-stack">
                  <div className="rf-row">
                    <div className="rf-stack">
                      <p>
                        <strong>{session.title}</strong> · {session.professional_name}
                        {cancelled && <span className="rf-badge rf-badge--cancelled"> {t("groups.cancelled")}</span>}
                      </p>
                      <p className="rf-muted">
                        {formatWeekday(session.starts_at)}, {formatTime(session.starts_at)}–
                        {formatTime(session.ends_at)} ·{" "}
                        {t("groups.places", { enrolled: session.enrolled, capacity: session.capacity })}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : session.id)}
                    >
                      {expanded
                        ? t("groups.close", { title: session.title })
                        : t("groups.open", { title: session.title })}
                    </Button>
                  </div>
                  {expanded && <GroupSessionDetail sessionId={session.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

// React Router loads a lazy route's component from this export.
export { GroupSessionsPage as Component };

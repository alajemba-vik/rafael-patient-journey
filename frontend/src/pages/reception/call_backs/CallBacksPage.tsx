import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useCallBacks } from "../../../api/reception";
import { paths } from "../../../app/paths";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { PageHeader } from "../../../components/layout/PageHeader";
import { downloadCsv } from "../../../lib/csv";
import { formatDate, formatPhone, formatTime } from "../../../lib/format";

export function CallBacksPage() {
  const { t } = useTranslation();
  const callBacks = useCallBacks();

  return (
    <div className="rf-narrow">
      <PageHeader title={t("callBacks.title")}>
        {callBacks.data && callBacks.data.length > 0 && (
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(
                "a-rappeler.csv",
                [t("export.patient"), t("export.phone"), t("export.missed"), t("export.lastMissed"), t("export.next")],
                callBacks.data.map((c) => [
                  c.patient_name,
                  c.phone ? formatPhone(c.phone) : null,
                  c.missed,
                  `${formatDate(c.last_missed_at)} ${formatTime(c.last_missed_at)}`,
                  c.next_appointment_at
                    ? `${formatDate(c.next_appointment_at)} ${formatTime(c.next_appointment_at)}`
                    : t("export.nothingBooked"),
                ]),
              )
            }
          >
            {t("export.csv")}
          </Button>
        )}
      </PageHeader>
      <p className="rf-muted rf-section">{t("callBacks.intro")}</p>
      <QueryState
        query={callBacks}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: t("callBacks.empty"),
          children: <p>{t("callBacks.emptyHint")}</p>,
        }}
      >
        {(list) => (
          <ul className="rf-list">
            {list.map((c) => (
              <li key={c.patient_id}>
                <div className="rf-stack">
                  <p>
                    <Link
                      className="rf-link"
                      to={paths.reception.patient(c.patient_id)}
                      aria-label={t("callBacks.open", { name: c.patient_name })}
                    >
                      {c.patient_name}
                    </Link>{" "}
                    <span className="rf-badge rf-badge--no_show">{t("callBacks.missed", { count: c.missed })}</span>
                  </p>
                  <p className="rf-muted">
                    {t("callBacks.lastMissed", { date: formatDate(c.last_missed_at) })} ·{" "}
                    {c.next_appointment_at
                      ? t("callBacks.next", {
                          date: formatDate(c.next_appointment_at),
                          time: formatTime(c.next_appointment_at),
                        })
                      : t("callBacks.nothingBooked")}
                  </p>
                </div>
                {c.phone ? (
                  <a
                    className="rf-btn rf-btn--secondary"
                    href={`tel:${c.phone}`}
                    aria-label={t("callBacks.call", { name: c.patient_name })}
                  >
                    {formatPhone(c.phone)}
                  </a>
                ) : (
                  <span className="rf-muted">{t("callBacks.noPhone")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

// React Router loads a lazy route's component from this export.
export { CallBacksPage as Component };

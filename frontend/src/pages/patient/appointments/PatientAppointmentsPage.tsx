import { useTranslation } from "react-i18next";

import { useMyAppointments } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { formatTime, formatWeekday } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { MyGroupSessions } from "./MyGroupSessions";
import { RateSessions } from "./RateSessions";

export function PatientAppointmentsPage() {
  const { t } = useTranslation();
  const appointments = useMyAppointments();

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <PageHeader title={t("patientAppointments.title")} />
      <RateSessions />
      <MyGroupSessions />

      <QueryState
        query={appointments}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: t("patientAppointments.empty"),
          children: <p className="rf-lead">{t("patientAppointments.emptyHint")}</p>,
        }}
      >
        {(list) => (
          <div className="rf-stack" style={{ gap: "var(--space-4)" }}>
            <p className="rf-muted" style={{ marginBottom: "var(--space-2)" }}>
              {t("patientAppointments.intro")}
            </p>

            {list.map((a) => (
              <div
                key={a.id}
                className="rf-panel"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-4) var(--space-5)",
                  borderLeft: "6px solid var(--accent)", // Bande orange sur le côté gauche
                  flexWrap: "wrap",
                  gap: "var(--space-4)",
                }}
              >
                {/* Bloc Date / Heure */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "200px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: "18px",
                      color: "var(--ink)",
                    }}
                  >
                    {formatWeekday(a.starts_at)}
                  </span>
                  <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: "15px" }}>
                    🕒 {formatTime(a.starts_at)} – {formatTime(a.ends_at)}
                  </span>
                </div>

                {/* Bloc Praticien */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                  <span
                    className="rf-muted"
                    style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}
                  >
                    {t("patientAppointments.with")}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "16px" }}>{a.professional_name}</span>
                </div>

                {/* Bloc Statut */}
                <div>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

// React Router loads a lazy route's component from this export.
export { PatientAppointmentsPage as Component };

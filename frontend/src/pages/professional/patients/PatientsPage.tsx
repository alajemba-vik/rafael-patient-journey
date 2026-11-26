import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { usePermissions } from "../../../api/identity_access";
import { usePatients } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { TextField } from "../../../components/forms/TextField";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { formatDate } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { paths } from "../../../app/paths";

// Fonction pour générer les initiales du patient
function getInitials(first: string, last: string) {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase();
}

export function PatientsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [unassigned, setUnassigned] = useState(false);
  const patients = usePatients(useDebouncedValue(search), unassigned);
  const canTakeOn = usePermissions().takeOnPatients;

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
      <PageHeader title={unassigned ? t("proPatients.titleUnassigned") : t("proPatients.titleMine")} />

      {/* Barre d'outils avec fond doux pour démarquer la recherche */}
      <div
        className="rf-toolbar"
        style={{
          background: "var(--surface-tint)",
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--space-6)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          alignItems: "center",
        }}
      >
        {canTakeOn && (
          <div className="rf-segmented" role="group" aria-label={t("proPatients.whichPatients")}>
            <button type="button" aria-pressed={!unassigned} onClick={() => setUnassigned(false)}>
              {t("proPatients.mine")}
            </button>
            <button type="button" aria-pressed={unassigned} onClick={() => setUnassigned(true)}>
              {t("proPatients.unassigned")}
            </button>
          </div>
        )}
        <div style={{ flex: 1, minWidth: "250px" }}>
          <TextField
            label={t("proPatients.search")}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <QueryState
        query={patients}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: search
            ? t("proPatients.noMatch")
            : unassigned
              ? t("proPatients.allAssigned")
              : t("proPatients.noneActive"),
        }}
      >
        {(list) => (
          <div className="rf-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {list.map((p) => (
              <Link
                key={p.id}
                to={paths.pro.patient(p.id)}
                className="rf-panel"
                style={{
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  borderTop: "4px solid var(--hairline)",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-4)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderTopColor = "var(--accent)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderTopColor = "var(--hairline)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                {/* Avatar avec initiales */}
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--secondary-blue)",
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: "18px",
                    flexShrink: 0,
                  }}
                >
                  {getInitials(p.first_name, p.last_name)}
                </div>

                {/* Infos Patient */}
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontSize: "16px",
                      color: "var(--ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.last_name.toUpperCase()} <span style={{ fontWeight: 400 }}>{p.first_name}</span>
                  </h3>
                  <span className="rf-muted" style={{ fontSize: "13px", marginTop: "4px" }}>
                    {t("proPatients.bornOn", { date: formatDate(p.birth_date) })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

export { PatientsPage as Component };

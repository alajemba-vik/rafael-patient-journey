import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { usePatients } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { TextField } from "../../../components/forms/TextField";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { formatDate, formatPhone } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { RegisterPatientForm } from "./RegisterPatientForm";
import { paths } from "../../../app/paths";

// Fonction pour générer les initiales
function getInitials(first: string, last: string) {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase();
}

export function ReceptionPatientsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const patients = usePatients(useDebouncedValue(search));

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
      <PageHeader title={t("receptionPatients.title")} />

      {/* Formulaire d'enregistrement dans un accordéon */}
      <details className="rf-disclosure rf-section" style={{ marginBottom: "var(--space-6)" }}>
        <summary>{t("receptionPatients.register")}</summary>
        <div className="rf-disclosure__body">
          <RegisterPatientForm />
        </div>
      </details>

      {/* Barre de recherche dans un bandeau doux */}
      <div
        className="rf-toolbar"
        style={{
          background: "var(--surface-tint)",
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--space-6)",
        }}
      >
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <TextField
            label={t("receptionPatients.search")}
            hint={t("receptionPatients.searchHint")}
            type="search"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <QueryState
        query={patients}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: search ? t("receptionPatients.noMatch") : t("receptionPatients.none"),
        }}
      >
        {(list) => (
          <div className="rf-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {list.map((p) => (
              <Link
                key={p.id}
                to={paths.reception.patient(p.id)}
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
                    background: "var(--accent-doux)",
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
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
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

                  <div
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}
                  >
                    <span className="rf-muted" style={{ fontSize: "13px" }}>
                      {t("receptionPatients.bornOn", { date: formatDate(p.birth_date) })}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>
                      {p.phone ? formatPhone(p.phone) : ""}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

export { ReceptionPatientsPage as Component };

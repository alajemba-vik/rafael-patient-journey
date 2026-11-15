import { useState } from "react";
import { Link } from "react-router";

import { usePatients } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { TextField } from "../../../components/forms/TextField";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { formatDate, formatPhone } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { RegisterPatientForm } from "./RegisterPatientForm";
import { paths } from "../../../app/paths";

export function ReceptionPatientsPage() {
  const [search, setSearch] = useState("");
  const patients = usePatients(useDebouncedValue(search));

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader title="Patients" />
      
      {/* Formulaire d'enregistrement dans un accordéon plus doux */}
      <details className="rf-disclosure rf-section" style={{ marginBottom: 'var(--space-6)' }}>
        <summary>➕ Enregistrer un nouveau patient</summary>
        <div className="rf-disclosure__body">
          <RegisterPatientForm />
        </div>
      </details>

      <div className="rf-toolbar" style={{ background: 'var(--surface-tint)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <TextField
            label="Rechercher par nom ou téléphone"
            hint="Début du nom, ou au moins 3 chiffres du numéro."
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
          title: search ? "Aucun patient ne correspond à cette recherche." : "Aucun patient enregistré.",
        }}
      >
        {(list) => (
          <div className="rf-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }} aria-label="Patients">
            {list.map((p) => (
              <Link 
                key={p.id} 
                to={paths.reception.patient(p.id)}
                className="rf-panel" 
                style={{ 
                  textDecoration: 'none', 
                  transition: 'all 0.2s ease',
                  borderTop: '4px solid var(--hairline)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderTopColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderTopColor = 'var(--hairline)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--ink)' }}>
                      {p.last_name.toUpperCase()} <span style={{ fontWeight: 400 }}>{p.first_name}</span>
                    </h3>
                    <span className="rf-muted" style={{ fontSize: '13px' }}>
                      né·e le {formatDate(p.birth_date)}
                    </span>
                  </div>
                  <span style={{ fontSize: '24px', opacity: 0.5 }}>👤</span>
                </div>
                
                <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px dashed var(--hairline)', fontSize: '14px', color: 'var(--ink-muted)' }}>
                  📞 {p.phone ? formatPhone(p.phone) : "Pas de téléphone"}
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
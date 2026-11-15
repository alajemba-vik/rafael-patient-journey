import { Link } from "react-router";

import { useMe } from "../../../api/identity_access";
import { useMyPathways } from "../../../api/pathways";
import { useDueQuestionnaires, useMyScores } from "../../../api/questionnaires";
import { useMyAppointments } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatDate, formatNumber, formatTime, formatWeekday } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { paths } from "../../../app/paths";

const UPCOMING_SHOWN = 3;

export function PatientHomePage() {
  const me = useMe();
  const due = useDueQuestionnaires();
  const appointments = useMyAppointments();
  const pathways = useMyPathways();
  const scores = useMyScores();
  const firstName = me.data?.full_name.split(" ")[0];

  return (
    <>
      <PageHeader title="Mon espace" />
      
      {/* Message d'accueil personnalisé et chaleureux */}
      {firstName && (
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '36px',
          fontWeight: 800,
          color: 'var(--ink)',
          marginBottom: 'var(--space-7)',
          letterSpacing: '-0.5px'
        }}>
          Bonjour <span style={{ color: 'var(--accent)' }}>{firstName}</span> 👋
        </h2>
      )}

      <div className="rf-grid">
        
        {/* 1. QUESTIONNAIRE EN ATTENTE (Mis en évidence) */}
        {due.data && due.data.length > 0 && (
          <section className="rf-panel rf-panel--highlight" aria-labelledby="due-title">
            <h2 id="due-title" className="rf-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span aria-hidden="true">📝</span> Un questionnaire vous attend
            </h2>
            <p style={{ margin: 'var(--space-3) 0' }}>
              {due.data[0].title}. Quelques minutes suffisent.
            </p>
            <Link to={paths.patient.questionnaires} className="rf-btn">
              Répondre maintenant
            </Link>
          </section>
        )}

        {/* 2. PROCHAINS RENDEZ-VOUS */}
        <section className="rf-panel" aria-labelledby="next-title">
          <h2 id="next-title" className="rf-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true">📅</span> Vos prochains rendez-vous
          </h2>
          <QueryState
            query={appointments}
            empty={{ isEmpty: (list) => list.length === 0, title: "Aucun rendez-vous prévu." }}
          >
            {(list) => (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <ul className="rf-list">
                  {list.slice(0, UPCOMING_SHOWN).map((a) => (
                    <li key={a.id} style={{ padding: 'var(--space-4) 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>
                          {formatWeekday(a.starts_at)} à {formatTime(a.starts_at)}
                        </span>
                        <span className="rf-muted">Avec {a.professional_name}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link to={paths.patient.appointments} className="rf-link" style={{ marginTop: 'auto' }}>
                  Voir tous vos rendez-vous →
                </Link>
              </div>
            )}
          </QueryState>
        </section>

        {/* 3. PARCOURS */}
        <section className="rf-panel" aria-labelledby="pathway-title">
          <h2 id="pathway-title" className="rf-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true">🧭</span> Votre parcours
          </h2>
          <QueryState
            query={pathways}
            empty={{ isEmpty: (list) => list.length === 0, title: "Votre parcours n’a pas encore commencé." }}
          >
            {([current]) => (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <dl className="rf-dl" style={{ marginBottom: 'var(--space-4)' }}>
                  <dt>Votre coordinateur·rice</dt>
                  <dd>{current.coordinator_name}</dd>
                  <dt>Commencé le</dt>
                  <dd>{formatDate(current.opened_at)}</dd>
                </dl>
                <Link to={paths.patient.pathway} className="rf-link" style={{ marginTop: 'auto' }}>
                  Voir votre parcours →
                </Link>
              </div>
            )}
          </QueryState>
        </section>

        {/* 4. QUALITÉ DE VIE */}
        <section className="rf-panel" aria-labelledby="score-title">
          <h2 id="score-title" className="rf-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true">📊</span> Votre qualité de vie
          </h2>
          <QueryState
            query={scores}
            empty={{
              isEmpty: (list) => list.length === 0,
              title: "Vos résultats apparaîtront après votre premier questionnaire.",
            }}
          >
            {(list) => {
              const latest = list[list.length - 1];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span className="rf-figure" style={{ color: 'var(--accent)', fontSize: '42px' }}>
                      {formatNumber(latest.score)}
                    </span> 
                    <span className="rf-muted">/ 100</span>
                  </p>
                  
                  {/* Petite barre visuelle pour le score */}
                  <div style={{ height: '8px', background: 'var(--surface-tint)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${latest.score}%`, height: '100%', background: 'var(--accent)' }}></div>
                  </div>

                  {latest.change !== null && (
                    <p className="rf-muted" style={{ margin: 0, fontSize: '13px' }}>
                      {formatChange(latest.change)} depuis le mois précédent
                    </p>
                  )}
                </div>
              );
            }}
          </QueryState>
        </section>
      </div>
    </>
  );
}

// React Router loads a lazy route's component from this export.
export { PatientHomePage as Component };
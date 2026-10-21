import { Link } from "react-router";

import { useMe } from "../../../api/me";
import { useMyPathways } from "../../../api/pathways";
import { useDueQuestionnaires, useMyScores } from "../../../api/questionnaires";
import { useMyAppointments } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatChange, formatDate, formatNumber, formatTime, formatWeekday } from "../../../components/format";
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
      <PageHeader title="Accueil" />
      {firstName && <p className="rf-lead">Bonjour {firstName}.</p>}

      <div className="rf-grid">
        {due.data && due.data.length > 0 && (
          <section className="rf-panel rf-panel--highlight" aria-labelledby="due-title">
            <h2 id="due-title" className="rf-title">
              Un questionnaire vous attend
            </h2>
            <p>{due.data[0].title}. Quelques minutes suffisent.</p>
            <Link to={paths.patient.questionnaires} className="rf-btn">
              Répondre
            </Link>
          </section>
        )}

        <section className="rf-panel" aria-labelledby="next-title">
          <h2 id="next-title" className="rf-title">
            Vos prochains rendez-vous
          </h2>
          <QueryState
            query={appointments}
            empty={{ isEmpty: (list) => list.length === 0, title: "Aucun rendez-vous prévu." }}
          >
            {(list) => (
              <>
                <ul className="rf-list">
                  {list.slice(0, UPCOMING_SHOWN).map((a) => (
                    <li key={a.id}>
                      <span>
                        {formatWeekday(a.starts_at)} à {formatTime(a.starts_at)}
                      </span>
                      <span className="rf-muted">{a.professional_name}</span>
                    </li>
                  ))}
                </ul>
                <Link to={paths.patient.appointments} className="rf-link">
                  Voir tous vos rendez-vous
                </Link>
              </>
            )}
          </QueryState>
        </section>

        <section className="rf-panel" aria-labelledby="pathway-title">
          <h2 id="pathway-title" className="rf-title">
            Votre parcours
          </h2>
          <QueryState
            query={pathways}
            empty={{ isEmpty: (list) => list.length === 0, title: "Votre parcours n’a pas encore commencé." }}
          >
            {([current]) => (
              <>
                <dl className="rf-dl">
                  <dt>Votre coordinatrice ou coordinateur</dt>
                  <dd>{current.coordinator_name}</dd>
                  <dt>Commencé le</dt>
                  <dd>{formatDate(current.opened_at)}</dd>
                </dl>
                <Link to={paths.patient.pathway} className="rf-link">
                  Voir votre parcours
                </Link>
              </>
            )}
          </QueryState>
        </section>

        <section className="rf-panel" aria-labelledby="score-title">
          <h2 id="score-title" className="rf-title">
            Votre qualité de vie
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
                <>
                  <p>
                    <span className="rf-figure">{formatNumber(latest.score)}</span> / 100
                  </p>
                  {latest.change !== null && (
                    <p className="rf-muted">{formatChange(latest.change)} depuis le mois précédent</p>
                  )}
                </>
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

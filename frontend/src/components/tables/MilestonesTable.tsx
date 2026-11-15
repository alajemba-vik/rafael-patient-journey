import type { Schemas } from "../../api/core/client";
import { DIMENSIONS, MILESTONE_LABELS } from "../../lib/labels";

type Milestone = Schemas["PatientMilestone"];

// Fonction pour choisir la couleur du score (0 à 4)
function getScoreColor(score: number | null | undefined) {
  switch (score) {
    case 0: return '#1A1A1A'; // Noir
    case 1: return '#E53935'; // Rouge
    case 2: return '#F0A500'; // Jaune / Orange
    case 3: return '#43A047'; // Vert
    case 4: return '#1E88E5'; // Bleu
    default: return 'inherit';
  }
}

/** The 0–4 self-assessment at each milestone, one column per milestone, so progress reads across. */
export function MilestonesTable({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="rf-table-wrap rf-narrow">
      <table className="rf-table">
        {/* Ajout de padding sur la légende pour l'aérer */}
        <caption className="rf-muted" style={{ textAlign: 'left', padding: 'var(--space-4) var(--space-5)' }}>
          Auto-évaluation, de 0 à 4
        </caption>
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            {milestones.map((m) => (
              <th key={m.kind} scope="col" className="rf-num">
                {MILESTONE_LABELS[m.kind]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIMENSIONS.map(([key, label]) => (
            <tr key={key}>
              <th scope="row" style={{ fontWeight: 600 }}>{label}</th>
              {milestones.map((m) => {
                const score = m[key];
                return (
                  <td key={m.kind} className="rf-num">
                    {score !== undefined && score !== null ? (
                      <span style={{ 
                        fontSize: '24px', 
                        fontWeight: 800, 
                        fontFamily: 'var(--font-display)',
                        color: getScoreColor(score) 
                      }}>
                        {score}
                      </span>
                    ) : (
                      <span className="rf-muted">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
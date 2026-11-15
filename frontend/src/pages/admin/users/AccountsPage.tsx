import { useAccounts } from "../../../api/identity_access";
import { QueryState } from "../../../components/feedback/QueryState";
import { ROLE_LABELS } from "../../../lib/labels";
import { PageHeader } from "../../../components/layout/PageHeader";
import { CreateAccountForm } from "./CreateAccountForm";

// Fonction pour générer les initiales
function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

// Fonction pour donner une couleur à chaque rôle
function getRoleColor(role: string) {
  switch (role) {
    case "admin": return { bg: "#FEE2E2", text: "#991B1B" }; // Rouge
    case "professional": return { bg: "var(--secondary-blue)", text: "#1E3A8A" }; // Bleu
    case "secretary": return { bg: "var(--accent-doux)", text: "#92400E" }; // Orange
    case "patient": return { bg: "var(--secondary-green)", text: "#166534" }; // Vert
    default: return { bg: "var(--surface-tint)", text: "var(--ink)" }; // Gris
  }
}

export function AccountsPage() {
  const accounts = useAccounts();

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <PageHeader title="Comptes utilisateurs" />
      
      {/* Le formulaire de création, bien enveloppé dans son accordéon */}
      <details className="rf-disclosure rf-section" style={{ marginBottom: 'var(--space-7)' }}>
        <summary>➕ Créer un nouveau compte</summary>
        <div className="rf-disclosure__body">
          <CreateAccountForm />
        </div>
      </details>

      <QueryState query={accounts} empty={{ isEmpty: (list) => list.length === 0, title: "Aucun compte enregistré." }}>
        {(list) => (
          <div className="rf-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {list.map((a) => {
              const roleStyle = getRoleColor(a.role);
              return (
                <div key={a.id} className="rf-panel" style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 'var(--space-4)', 
                  padding: 'var(--space-5)',
                  borderTop: `4px solid ${roleStyle.text}` // Bordure colorée selon le rôle
                }}>
                  
                  {/* Rond avec les initiales */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--surface-tint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '18px',
                    color: 'var(--ink)',
                    flexShrink: 0
                  }}>
                    {getInitials(a.full_name)}
                  </div>

                  {/* Infos de l'utilisateur */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0, flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.full_name}
                    </h3>
                    <p className="rf-muted" style={{ margin: 0, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.email}
                    </p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'var(--space-1)' }}>
                      {/* Badge du rôle */}
                      <span style={{ 
                        background: roleStyle.bg, 
                        color: roleStyle.text, 
                        padding: '4px 10px', 
                        borderRadius: 'var(--radius-xs)', 
                        fontSize: '12px', 
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {ROLE_LABELS[a.role]}
                      </span>

                      {/* Badge de discipline si applicable */}
                      {a.discipline && (
                        <span style={{ 
                          background: 'transparent', 
                          color: 'var(--ink-muted)', 
                          border: '1px solid var(--hairline)',
                          padding: '3px 10px', 
                          borderRadius: 'var(--radius-xs)', 
                          fontSize: '12px', 
                          fontWeight: 600
                        }}>
                          {a.discipline}
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}

export { AccountsPage as Component };
import { useAccounts } from "../../../api/accounts";
import { QueryState } from "../../../components/feedback/QueryState";
import { ROLE_LABELS } from "../../../components/labels";
import { PageHeader } from "../../../components/layout/PageHeader";
import { CreateAccountForm } from "./CreateAccountForm";

export function AccountsPage() {
  const accounts = useAccounts();

  return (
    <>
      <PageHeader title="Comptes" />
      <details className="rf-disclosure rf-section">
        <summary>Créer un compte</summary>
        <div className="rf-disclosure__body">
          <CreateAccountForm />
        </div>
      </details>
      <QueryState query={accounts} empty={{ isEmpty: (list) => list.length === 0, title: "Aucun compte." }}>
        {(list) => (
          <div className="rf-table-wrap">
            <table className="rf-table">
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Rôle</th>
                  <th scope="col">Discipline</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td>{a.full_name}</td>
                    <td>{a.email}</td>
                    <td>{ROLE_LABELS[a.role]}</td>
                    <td>{a.discipline ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </>
  );
}

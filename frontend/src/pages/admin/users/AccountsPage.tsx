import { useAccounts, useMe } from "../../../api/identity_access";
import { QueryState } from "../../../components/feedback/QueryState";
import { PageHeader } from "../../../components/layout/PageHeader";
import { AccountRow } from "./AccountRow";
import { CreateAccountForm } from "./CreateAccountForm";

export function AccountsPage() {
  const accounts = useAccounts();
  const me = useMe();

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
                  <th scope="col">État</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <AccountRow key={a.id} account={a} isSelf={a.id === me.data?.id} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </>
  );
}

// React Router loads a lazy route's component from this export.
export { AccountsPage as Component };

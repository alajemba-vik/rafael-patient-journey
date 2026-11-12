import { ApiError } from "../../../api/core/client";
import { useUpdateAccount, type Account, type Role } from "../../../api/identity_access";
import { Button } from "../../../components/forms/Button";
import { ConfirmButton } from "../../../components/forms/ConfirmButton";
import { ROLE_LABELS } from "../../../lib/labels";

// A patient login is tied to a patient record, so it never becomes a staff login or the reverse.
const STAFF_ROLES: Role[] = ["secretary", "professional", "coordinator", "admin"];

/** One account: its role, whether it can log in, and the admin's actions on it. */
export function AccountRow({ account, isSelf }: { account: Account; isSelf: boolean }) {
  const update = useUpdateAccount();
  const whose = <span className="rf-visually-hidden"> le compte de {account.full_name}</span>;

  return (
    <tr>
      <td>{account.full_name}</td>
      <td>{account.email}</td>
      <td>
        {isSelf || account.role === "patient" ? (
          ROLE_LABELS[account.role]
        ) : (
          <select
            className="rf-input"
            aria-label={`Rôle de ${account.full_name}`}
            value={account.role}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ id: account.id, body: { role: e.target.value as Role } })}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        )}
      </td>
      <td>{account.discipline ?? "—"}</td>
      <td>
        <span className={`rf-badge ${account.is_active ? "rf-badge--arrived" : "rf-badge--cancelled"}`}>
          {account.is_active ? "Actif" : "Désactivé"}
        </span>
      </td>
      <td>
        {isSelf ? (
          <span className="rf-muted">Votre compte</span>
        ) : account.is_active ? (
          <ConfirmButton
            question={`Désactiver le compte de ${account.full_name} ? La personne ne pourra plus se connecter.`}
            confirmLabel="Désactiver"
            onConfirm={() => update.mutate({ id: account.id, body: { is_active: false } })}
            pending={update.isPending}
          >
            Désactiver{whose}
          </ConfirmButton>
        ) : (
          <Button
            variant="secondary"
            pending={update.isPending}
            onClick={() => update.mutate({ id: account.id, body: { is_active: true } })}
          >
            Réactiver{whose}
          </Button>
        )}
        {update.isError && (
          <p className="rf-field__error" role="alert">
            {update.error instanceof ApiError && update.error.status === 409
              ? "Ce changement n’est pas autorisé pour ce compte."
              : "Le changement n’a pas abouti. Réessayez."}
          </p>
        )}
      </td>
    </tr>
  );
}

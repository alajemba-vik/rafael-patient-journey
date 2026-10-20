import { Link } from "react-router";

import { PageHeader } from "../../../components/layout/PageHeader";

export function NotFoundPage() {
  return (
    <div className="rf-narrow">
      <PageHeader title="Page introuvable" />
      <p>Cette adresse ne correspond à aucune page.</p>
      <Link to="/" className="rf-btn">
        Retour à l’accueil
      </Link>
    </div>
  );
}

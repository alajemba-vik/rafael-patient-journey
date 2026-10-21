import { Link } from "react-router";

import { PageHeader } from "../../../components/layout/PageHeader";
import { paths } from "../../../app/paths";

export function NotFoundPage() {
  return (
    <div className="rf-narrow">
      <PageHeader title="Page introuvable" />
      <p>Cette adresse ne correspond à aucune page.</p>
      <Link to={paths.home} className="rf-btn">
        Retour à l’accueil
      </Link>
    </div>
  );
}
